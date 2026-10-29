import 'server-only';

import { getDb } from '@/lib/db';
import { getAccount } from '@/lib/db/repository';
import { verifyPasswordHash } from '@/lib/password';
import { verifyPassword as verifyEnvPassword } from '@/lib/session';

/** Senha trocada pelo perfil (hash no banco) vale mais que APP_PASSWORD; o env só serve até a primeira troca. */
export async function checkAccountPassword(candidate: string): Promise<boolean> {
  const { passwordHash } = await getAccount(getDb());
  return passwordHash ? verifyPasswordHash(candidate, passwordHash) : verifyEnvPassword(candidate);
}
