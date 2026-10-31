'use server';

import { headers } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { checkUserPassword, normalizeEmail } from '@/lib/account';
import { requireUserId } from '@/lib/auth';
import { getDb } from '@/lib/db';
import { createUser as insertUser, findUserByEmail, getUser, updateUser } from '@/lib/db/repository';
import { hashPassword } from '@/lib/password';
import { MIN_PASSWORD_LENGTH } from '@/lib/password-rules';
import { createRateLimiter } from '@/lib/rate-limit';

export type ProfileFormState = { ok: boolean; message: string } | null;

// O e-mail é o login, então não dá mais para deixar em branco.
const emailSchema = z.email();

// A troca de senha confere a senha atual: limitar evita usar a tela como força bruta.
const checkPasswordChangeRate = createRateLimiter({ limit: 5, windowMs: 60_000 });

async function clientIp(): Promise<string> {
  const requestHeaders = await headers();
  return (
    requestHeaders.get('x-forwarded-for')?.split(',')[0].trim() ??
    requestHeaders.get('x-real-ip') ??
    'anonymous'
  );
}

/** E-mail já usado por outra conta. O índice único do banco é a garantia final. */
async function emailTaken(email: string, exceptUserId?: string): Promise<boolean> {
  const existing = await findUserByEmail(getDb(), email);
  return Boolean(existing && existing.id !== exceptUserId);
}

export async function saveEmail(_prev: ProfileFormState, formData: FormData): Promise<ProfileFormState> {
  const userId = await requireUserId();

  const parsed = emailSchema.safeParse(normalizeEmail(String(formData.get('email') ?? '')));
  if (!parsed.success) return { ok: false, message: 'E-mail inválido.' };
  if (await emailTaken(parsed.data, userId)) {
    return { ok: false, message: 'Esse e-mail já é usado por outra conta.' };
  }

  await updateUser(getDb(), userId, { email: parsed.data });
  revalidatePath('/perfil');
  return { ok: true, message: 'E-mail salvo. Use ele para entrar no app.' };
}

export async function changePassword(
  _prev: ProfileFormState,
  formData: FormData,
): Promise<ProfileFormState> {
  const userId = await requireUserId();

  const rate = checkPasswordChangeRate(await clientIp());
  if (!rate.allowed) {
    return { ok: false, message: `Muitas tentativas. Tente de novo em ${rate.retryAfterSeconds}s.` };
  }

  const current = formData.get('currentPassword');
  const next = formData.get('newPassword');
  const confirm = formData.get('confirmPassword');
  if (typeof current !== 'string' || typeof next !== 'string' || typeof confirm !== 'string') {
    return { ok: false, message: 'Preencha todos os campos.' };
  }
  if (next.length < MIN_PASSWORD_LENGTH) {
    return { ok: false, message: `A nova senha precisa ter pelo menos ${MIN_PASSWORD_LENGTH} caracteres.` };
  }
  if (next !== confirm) return { ok: false, message: 'A confirmação não bate com a nova senha.' };
  const user = await getUser(getDb(), userId);
  if (!user || !(await checkUserPassword(user, current))) {
    return { ok: false, message: 'Senha atual incorreta.' };
  }
  if (next === current) return { ok: false, message: 'A nova senha é igual à atual.' };

  await updateUser(getDb(), userId, { passwordHash: await hashPassword(next) });
  revalidatePath('/perfil');
  return { ok: true, message: 'Senha alterada. Use a nova senha no próximo login.' };
}

async function requireAdmin(): Promise<string | null> {
  const userId = await requireUserId();
  const user = await getUser(getDb(), userId);
  return user?.isAdmin ? userId : null;
}

/** Só o admin cria contas: não existe cadastro público. A pessoa nova troca a senha inicial no perfil dela. */
export async function createUser(_prev: ProfileFormState, formData: FormData): Promise<ProfileFormState> {
  if (!(await requireAdmin())) return { ok: false, message: 'Só o administrador pode criar contas.' };

  const parsed = emailSchema.safeParse(normalizeEmail(String(formData.get('email') ?? '')));
  if (!parsed.success) return { ok: false, message: 'E-mail inválido.' };
  const password = formData.get('password');
  if (typeof password !== 'string' || password.length < MIN_PASSWORD_LENGTH) {
    return { ok: false, message: `A senha inicial precisa ter pelo menos ${MIN_PASSWORD_LENGTH} caracteres.` };
  }
  if (await emailTaken(parsed.data)) return { ok: false, message: 'Esse e-mail já tem conta.' };

  await insertUser(getDb(), {
    id: crypto.randomUUID(),
    email: parsed.data,
    passwordHash: await hashPassword(password),
  });
  revalidatePath('/perfil');
  return { ok: true, message: `Conta criada. ${parsed.data} já pode entrar com a senha inicial.` };
}

/**
 * O admin define uma senha nova para outra conta (quem esqueceu a senha). Não pede a senha antiga;
 * a própria senha o admin troca pelo formulário normal, que confere a atual.
 */
export async function resetUserPassword(
  _prev: ProfileFormState,
  formData: FormData,
): Promise<ProfileFormState> {
  const adminId = await requireAdmin();
  if (!adminId) return { ok: false, message: 'Só o administrador pode redefinir senhas.' };

  const targetId = formData.get('userId');
  const password = formData.get('password');
  if (typeof targetId !== 'string' || !targetId) return { ok: false, message: 'Conta inválida.' };
  if (targetId === adminId) {
    return { ok: false, message: 'Para a sua senha, use "Trocar senha" acima.' };
  }
  if (typeof password !== 'string' || password.length < MIN_PASSWORD_LENGTH) {
    return { ok: false, message: `A nova senha precisa ter pelo menos ${MIN_PASSWORD_LENGTH} caracteres.` };
  }

  const target = await getUser(getDb(), targetId);
  if (!target) return { ok: false, message: 'Conta não encontrada.' };

  await updateUser(getDb(), targetId, { passwordHash: await hashPassword(password) });
  return { ok: true, message: `Senha redefinida. Passe a nova senha para ${target.email ?? 'a pessoa'}.` };
}
