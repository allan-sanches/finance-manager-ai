import { createHmac, timingSafeEqual } from 'node:crypto';

// Segredo da rota /api/cron/prices. CRON_SECRET permite chamar de um agendador de fora; sem ela,
// deriva do SESSION_SECRET para a rotina interna (instrumentation.ts) funcionar sem configuração.
// Sem import 'server-only' de propósito: o instrumentation.ts também usa este arquivo.

export function priceWatchSecret(): string | null {
  if (process.env.CRON_SECRET) return process.env.CRON_SECRET;
  const session = process.env.SESSION_SECRET;
  if (!session) return null;
  return createHmac('sha256', session).update('price-watch').digest('base64url');
}

export function isPriceWatchAuthorized(header: string | null): boolean {
  const secret = priceWatchSecret();
  if (!secret || !header?.startsWith('Bearer ')) return false;
  const given = Buffer.from(header.slice(7));
  const expected = Buffer.from(secret);
  return given.length === expected.length && timingSafeEqual(given, expected);
}
