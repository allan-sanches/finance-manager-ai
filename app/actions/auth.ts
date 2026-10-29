'use server';

import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';

import { createRateLimiter } from '@/lib/rate-limit';
import {
  SESSION_COOKIE,
  SESSION_TTL_SECONDS,
  createSessionToken,
  isAuthConfigured,
  safeRedirectPath,
  verifyPassword,
} from '@/lib/session';

export type LoginState = { error: string | null };

const checkLoginRate = createRateLimiter({ limit: 5, windowMs: 60_000 });

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

  const password = formData.get('password');
  if (typeof password !== 'string' || !(await verifyPassword(password))) {
    return { error: 'Senha incorreta.' };
  }

  const store = await cookies();
  store.set(SESSION_COOKIE, await createSessionToken(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_TTL_SECONDS,
  });

  redirect(safeRedirectPath(formData.get('next')));
}

export async function logout(): Promise<void> {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
  redirect('/login');
}
