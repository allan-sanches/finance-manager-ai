import 'server-only';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

import { SESSION_COOKIE, verifySessionToken } from '@/lib/session';

/** Id do usuário logado, ou null sem sessão válida. */
export async function getSessionUserId(): Promise<string | null> {
  const store = await cookies();
  return verifySessionToken(store.get(SESSION_COOKIE)?.value);
}

/**
 * Para Server Components e Server Actions: actions são endpoints públicos, então cada uma precisa
 * checar. Devolve o id que deve filtrar todo acesso ao banco.
 */
export async function requireUserId(): Promise<string> {
  const userId = await getSessionUserId();
  if (!userId) redirect('/login');
  return userId;
}
