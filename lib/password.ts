import 'server-only';

import { randomBytes, scrypt as scryptCallback, timingSafeEqual, type ScryptOptions } from 'node:crypto';

// Formato guardado no banco: "scrypt$<N>$<r>$<p>$<salt base64url>$<hash base64url>".
// Os parâmetros vão junto para dar para endurecer no futuro sem invalidar hashes antigos.
const PARAMS = { N: 2 ** 15, r: 8, p: 1 } as const;
const KEY_LENGTH = 64;
// O padrão do Node (32 MiB) é exatamente 128 * N * r com N = 2^15, sem folga.
const MAX_MEMORY = 64 * 1024 * 1024;

function scrypt(password: string, salt: Buffer, options: ScryptOptions): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scryptCallback(password, salt, KEY_LENGTH, { ...options, maxmem: MAX_MEMORY }, (err, key) =>
      err ? reject(err) : resolve(key),
    );
  });
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await scrypt(password, salt, PARAMS);
  return ['scrypt', PARAMS.N, PARAMS.r, PARAMS.p, salt.toString('base64url'), key.toString('base64url')].join('$');
}

export async function verifyPasswordHash(password: string, stored: string): Promise<boolean> {
  const [algo, n, r, p, salt, hash, ...rest] = stored.split('$');
  if (algo !== 'scrypt' || !salt || !hash || rest.length > 0) return false;
  const expected = Buffer.from(hash, 'base64url');
  const key = await scrypt(password, Buffer.from(salt, 'base64url'), {
    N: Number(n),
    r: Number(r),
    p: Number(p),
  });
  return key.length === expected.length && timingSafeEqual(key, expected);
}
