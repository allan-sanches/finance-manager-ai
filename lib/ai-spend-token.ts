import { createHash, timingSafeEqual } from 'node:crypto';

// A porta de /api/ai-spend: um token longo, que só o dono do app tem (AI_SPEND_TOKEN).
// Sem import 'server-only' de propósito: o teste roda este arquivo no Node puro.

export const MIN_AI_SPEND_TOKEN_LENGTH = 32;

/** O dia de um instante, em UTC: "2026-11-23". */
export const utcDay = (time: number) => new Date(time).toISOString().slice(0, 10);

/**
 * O cabeçalho `Authorization: Bearer <token>` confere com o token esperado? Compara os resumos
 * (SHA-256) em tempo constante: o tamanho do token não vaza e a comparação não para no primeiro
 * caractere diferente.
 */
export function isAiSpendAuthorized(header: string | null, expected: string | undefined): boolean {
  if (!expected || expected.length < MIN_AI_SPEND_TOKEN_LENGTH) return false;
  const given = header?.match(/^Bearer (.+)$/)?.[1];
  if (!given) return false;
  const digest = (value: string) => createHash('sha256').update(value).digest();
  return timingSafeEqual(digest(given), digest(expected));
}
