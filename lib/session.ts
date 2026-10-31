// Sessão: cookie com "<userId>.<expiraEm>.<hmac>" assinado com SESSION_SECRET.
// Sem "server-only" porque o proxy.ts também importa; não há segredo neste arquivo, só lógica.

export const SESSION_COOKIE = 'fm_session';
export const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30;
const MIN_SECRET_LENGTH = 32;

const encoder = new TextEncoder();

function getSecret(): string | null {
  const secret = process.env.SESSION_SECRET;
  return secret && secret.length >= MIN_SECRET_LENGTH ? secret : null;
}

async function hmac(secret: string, value: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(value));
  let binary = '';
  for (const byte of new Uint8Array(signature)) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export function isAuthConfigured(): boolean {
  return Boolean(getSecret() && process.env.APP_PASSWORD);
}

// IDs de usuário: 'owner' ou UUID. Sem ponto nem dois-pontos, que separam as partes do token.
const USER_ID_PATTERN = /^[A-Za-z0-9-]+$/;

export async function createSessionToken(userId: string, now: number = Date.now()): Promise<string> {
  const secret = getSecret();
  if (!secret) throw new Error('SESSION_SECRET ausente ou com menos de 32 caracteres.');
  if (!USER_ID_PATTERN.test(userId)) throw new Error('ID de usuário inválido para a sessão.');
  const expiresAt = String(Math.floor(now / 1000) + SESSION_TTL_SECONDS);
  return `${userId}.${expiresAt}.${await hmac(secret, `session:${userId}:${expiresAt}`)}`;
}

/** Devolve o id do usuário dono do token, ou null se for inválido ou expirado. */
export async function verifySessionToken(
  token: string | undefined | null,
  now: number = Date.now(),
): Promise<string | null> {
  const secret = getSecret();
  if (!secret || !token) return null;
  const [userId, expiresAt, signature, ...rest] = token.split('.');
  if (!userId || !expiresAt || !signature || rest.length > 0) return null;
  if (!USER_ID_PATTERN.test(userId)) return null;
  if (!/^\d+$/.test(expiresAt) || Number(expiresAt) * 1000 <= now) return null;
  const valid = safeEqual(signature, await hmac(secret, `session:${userId}:${expiresAt}`));
  return valid ? userId : null;
}

/** Compara via HMAC para que o tempo não dependa de quantos caracteres batem. */
export async function verifyPassword(candidate: string): Promise<boolean> {
  const secret = getSecret();
  const expected = process.env.APP_PASSWORD;
  if (!secret || !expected) return false;
  const [a, b] = await Promise.all([
    hmac(secret, `password:${candidate}`),
    hmac(secret, `password:${expected}`),
  ]);
  return safeEqual(a, b);
}

/** Aceita só caminhos internos, para o ?next= do login não virar open redirect. */
export function safeRedirectPath(value: unknown): string {
  if (typeof value !== 'string') return '/';
  if (!value.startsWith('/') || value.startsWith('//') || value.startsWith('/\\')) return '/';
  return value;
}
