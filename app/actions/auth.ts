'use server';

import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';

import { authenticate, normalizeEmail } from '@/lib/account';
import { setSessionCookie } from '@/lib/auth';
import { createRateLimiter } from '@/lib/rate-limit';
import { SESSION_COOKIE, isAuthConfigured, safeRedirectPath } from '@/lib/session';

export type LoginState = { error: string | null };

const checkLoginRate = createRateLimiter({ limit: 5, windowMs: 60_000 });
// O IP vem do X-Forwarded-For, que o cliente pode forjar; o limite por conta segura força bruta
// mesmo trocando o IP a cada tentativa.
const checkAccountLoginRate = createRateLimiter({ limit: 10, windowMs: 15 * 60_000 });

export async function login(_prev: LoginState, formData: FormData): Promise<LoginState> {
  if (!isAuthConfigured()) {
    return { error: 'Login não configurado no servidor (APP_PASSWORD e SESSION_SECRET).' };
  }

  const requestHeaders = await headers();
  const ip =
    requestHeaders.get('x-forwarded-for')?.split(',')[0].trim() ??
    requestHeaders.get('x-real-ip') ??
    'anonymous';
  const rate = checkLoginRate(ip);
  if (!rate.allowed) {
    return { error: `Muitas tentativas. Tente de novo em ${rate.retryAfterSeconds}s.` };
  }

  const email = formData.get('email') ?? '';
  const password = formData.get('password');
  if (typeof email !== 'string' || typeof password !== 'string') {
    return { error: 'E-mail ou senha incorretos.' };
  }
  const accountRate = checkAccountLoginRate(normalizeEmail(email));
  if (!accountRate.allowed) {
    return { error: `Muitas tentativas. Tente de novo em ${accountRate.retryAfterSeconds}s.` };
  }
  const user = await authenticate(email, password);
  if (!user) return { error: 'E-mail ou senha incorretos.' };

  await setSessionCookie(user.id, user.sessionVersion);
  redirect(safeRedirectPath(formData.get('next')));
}

export async function logout(): Promise<void> {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
  redirect('/login');
}
