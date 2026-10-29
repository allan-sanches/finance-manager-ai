'use server';

import { headers } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { checkAccountPassword } from '@/lib/account';
import { requireSession } from '@/lib/auth';
import { getDb } from '@/lib/db';
import { updateAccount } from '@/lib/db/repository';
import { hashPassword } from '@/lib/password';
import { MIN_PASSWORD_LENGTH } from '@/lib/password-rules';
import { createRateLimiter } from '@/lib/rate-limit';

export type ProfileFormState = { ok: boolean; message: string } | null;

const emailSchema = z.union([z.literal(''), z.email()]);

// A troca de senha confere a senha atual: limitar evita usar a tela como força bruta.
const checkPasswordChangeRate = createRateLimiter({ limit: 5, windowMs: 60_000 });

export async function saveEmail(_prev: ProfileFormState, formData: FormData): Promise<ProfileFormState> {
  await requireSession();

  const parsed = emailSchema.safeParse(String(formData.get('email') ?? '').trim().toLowerCase());
  if (!parsed.success) return { ok: false, message: 'E-mail inválido.' };

  await updateAccount(getDb(), { email: parsed.data || null });
  revalidatePath('/perfil');
  return { ok: true, message: parsed.data ? 'E-mail salvo.' : 'E-mail removido.' };
}

export async function changePassword(
  _prev: ProfileFormState,
  formData: FormData,
): Promise<ProfileFormState> {
  await requireSession();

  const requestHeaders = await headers();
  const ip =
    requestHeaders.get('x-forwarded-for')?.split(',')[0].trim() ??
    requestHeaders.get('x-real-ip') ??
    'anonymous';
  const rate = checkPasswordChangeRate(ip);
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
  if (!(await checkAccountPassword(current))) return { ok: false, message: 'Senha atual incorreta.' };
  if (next === current) return { ok: false, message: 'A nova senha é igual à atual.' };

  await updateAccount(getDb(), { passwordHash: await hashPassword(next) });
  return { ok: true, message: 'Senha alterada. Use a nova senha no próximo login.' };
}
