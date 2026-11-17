import 'server-only';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { cache } from 'react';

import { getDb } from '@/lib/db';
import { getUser } from '@/lib/db/repository';
import {
  SESSION_COOKIE,
  SESSION_TTL_SECONDS,
  createSessionToken,
  verifySessionToken,
} from '@/lib/session';

/**
 * Id do usuário logado, ou null sem sessão válida. Além da assinatura (que o proxy já confere),
 * a versão do cookie precisa ser a da conta: trocar a senha sobe a versão e derruba os outros
 * aparelhos. `cache` evita repetir a consulta no mesmo render.
 */
export const getSessionUserId = cache(async (): Promise<string | null> => {
  const store = await cookies();
  const claims = await verifySessionToken(store.get(SESSION_COOKIE)?.value);
  if (!claims) return null;
  const user = await getUser(getDb(), claims.userId);
  return user && user.sessionVersion === claims.version ? user.id : null;
});

/**
 * Para Server Components e Server Actions: actions são endpoints públicos, então cada uma precisa
 * checar. Devolve o id que deve filtrar todo acesso ao banco.
 */
export async function requireUserId(): Promise<string> {
  const userId = await getSessionUserId();
  if (!userId) redirect('/login');
  return userId;
}

/** Grava o cookie de sessão. Só em Server Actions e Route Handlers (onde dá para mexer em cookies). */
export async function setSessionCookie(userId: string, sessionVersion: number): Promise<void> {
  const store = await cookies();
  store.set(SESSION_COOKIE, await createSessionToken(userId, sessionVersion), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_TTL_SECONDS,
  });
}
