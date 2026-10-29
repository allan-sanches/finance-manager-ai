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
