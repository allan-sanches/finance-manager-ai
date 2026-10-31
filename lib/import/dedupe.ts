import { normalizeText } from '@/lib/import/statement';
import type { StatementEntry, Transaction } from '@/types/finance';

const keyOf = (t: Pick<Transaction, 'date' | 'type' | 'amount' | 'description'>) =>
  [t.date, t.type, Math.round(t.amount * 100), normalizeText(t.description)].join('|');

/**
 * Índices das linhas do extrato que já existem como transação (mesma data, tipo, valor e descrição).
 * Conta ocorrências: se o banco tem 1 e o extrato traz 2 iguais, só a primeira é marcada.
 */
export function findDuplicateEntries(
  entries: ReadonlyArray<StatementEntry>,
  existing: ReadonlyArray<Transaction>,
): Set<number> {
  const remaining = new Map<string, number>();
  for (const t of existing) {
    const key = keyOf(t);
    remaining.set(key, (remaining.get(key) ?? 0) + 1);
  }

  const duplicates = new Set<number>();
  entries.forEach((entry, i) => {
    const key = keyOf(entry);
    const count = remaining.get(key) ?? 0;
    if (count > 0) {
      duplicates.add(i);
      remaining.set(key, count - 1);
    }
  });
  return duplicates;
}

const DAY_MS = 86_400_000;
const daysApart = (a: string, b: string) =>
  Math.abs(Date.parse(`${a}T00:00:00Z`) - Date.parse(`${b}T00:00:00Z`)) / DAY_MS;

/**
 * Índices dos lançamentos da fatura que já existem no crédito desse cartão. A descrição da fatura
 * ("IFOOD *RESTAURANTE") quase nunca bate com a digitada ("Jantar"), então compara tipo e valor,
 * com até 1 dia de diferença na data. Cada transação existente casa com uma linha só.
 */
export function findDuplicateCardEntries(
  entries: ReadonlyArray<Pick<Transaction, 'date' | 'type' | 'amount'>>,
  existing: ReadonlyArray<Transaction>,
  cardId: string,
): Set<number> {
  const pool = existing.filter((t) => t.paymentMethod === 'credit_card' && t.creditCardId === cardId);
  const used = new Set<string>();
  const duplicates = new Set<number>();
  entries.forEach((entry, i) => {
    const cents = Math.round(entry.amount * 100);
    const match = pool.find(
      (t) =>
        !used.has(t.id) &&
        t.type === entry.type &&
        Math.round(t.amount * 100) === cents &&
        daysApart(t.date, entry.date) <= 1,
    );
    if (match) {
      used.add(match.id);
      duplicates.add(i);
    }
  });
  return duplicates;
}
