import 'server-only';

import { getDb } from '@/lib/db';
import { OWNER_ID, findUserByEmail, getUser, type UserRecord } from '@/lib/db/repository';
import { hashPassword, verifyPasswordHash } from '@/lib/password';
import { verifyPassword as verifyEnvPassword } from '@/lib/session';

export const normalizeEmail = (email: string) => email.trim().toLowerCase();

// Hash qualquer para gastar o mesmo tempo quando o e-mail não existe: sem isso, a demora do scrypt
// revela quais e-mails têm conta.
let dummyHash: Promise<string> | undefined;

/** Senha trocada pelo perfil (hash no banco) vale mais que APP_PASSWORD; o env só serve ao owner até a primeira troca. */
export async function checkUserPassword(user: UserRecord, candidate: string): Promise<boolean> {
  if (user.passwordHash) return verifyPasswordHash(candidate, user.passwordHash);
  return user.id === OWNER_ID ? verifyEnvPassword(candidate) : false;
}

/**
 * Login por e-mail e senha. E-mail em branco entra no owner enquanto ele não cadastrar um e-mail,
 * para a conta de antes do multiusuário não ficar trancada para fora.
 */
export async function authenticate(email: string, password: string): Promise<string | null> {
  const db = getDb();
  const normalized = normalizeEmail(email);
  let user: UserRecord | null;
  if (normalized) {
    user = await findUserByEmail(db, normalized);
  } else {
    const owner = await getUser(db, OWNER_ID);
    user = owner && !owner.email ? owner : null;
  }

  if (!user) {
    dummyHash ??= hashPassword('senha-que-nao-existe');
    await verifyPasswordHash(password, await dummyHash);
    return null;
  }
  return (await checkUserPassword(user, password)) ? user.id : null;
}
