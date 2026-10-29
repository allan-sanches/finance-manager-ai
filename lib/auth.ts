import 'server-only';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

import { SESSION_COOKIE, verifySessionToken } from '@/lib/session';

export async function hasSession(): Promise<boolean> {
  const store = await cookies();
  return verifySessionToken(store.get(SESSION_COOKIE)?.value);
}

/** Para Server Components e Server Actions: actions são endpoints públicos, então cada uma precisa checar. */
export async function requireSession(): Promise<void> {
  if (!(await hasSession())) redirect('/login');
}
