import { monthKey } from '@/lib/finance';
import type { Transaction } from '@/types/finance';

/** Lançamento de dívida: despesa na categoria "Dívidas" (parcela de empréstimo, acordo etc.). */
export function isDebtPayment(tx: Transaction): boolean {
  if (tx.type !== 'expense') return false;
  const category = tx.category.toLowerCase();
  return category.includes('dívida') || category.includes('divida');
}

/**
 * Separa o que já aconteceu do que é expectativa. Data depois de hoje = previsto,
 * mesmo dentro do mês atual (ex: conta fixa que vence dia 30).
 */
export function splitByTiming(
  transactions: ReadonlyArray<Transaction>,
  today: string,
): { realized: Transaction[]; expected: Transaction[] } {
  const realized: Transaction[] = [];
  const expected: Transaction[] = [];
  for (const tx of transactions) (tx.date > today ? expected : realized).push(tx);
  return { realized, expected };
}

export type MonthTotals = {
  key: string; // YYYY-MM
  income: number;
  expense: number; // Sem as dívidas
  debt: number;
  balance: number;
  count: number;
  openCount: number; // Ainda não pagos/recebidos
};

export function totalsOf(key: string, transactions: ReadonlyArray<Transaction>): MonthTotals {
  const totals: MonthTotals = { key, income: 0, expense: 0, debt: 0, balance: 0, count: 0, openCount: 0 };
  for (const tx of transactions) {
    if (tx.type === 'income') totals.income += tx.amount;
    else if (isDebtPayment(tx)) totals.debt += tx.amount;
    else totals.expense += tx.amount;
    totals.count += 1;
    if (!tx.isPaid) totals.openCount += 1;
  }
  totals.balance = totals.income - totals.expense - totals.debt;
  return totals;
}

/** Totais por mês; `order` 'desc' para o histórico (mais recente primeiro), 'asc' para o previsto. */
export function groupByMonth(
  transactions: ReadonlyArray<Transaction>,
  order: 'asc' | 'desc' = 'desc',
): MonthTotals[] {
  const groups = new Map<string, Transaction[]>();
  for (const tx of transactions) {
    const key = monthKey(tx.date);
    groups.set(key, [...(groups.get(key) ?? []), tx]);
  }
  const months = [...groups.entries()].map(([key, rows]) => totalsOf(key, rows));
  return months.sort((a, b) => (order === 'desc' ? b.key.localeCompare(a.key) : a.key.localeCompare(b.key)));
}

/** Mês anterior/seguinte de uma chave YYYY-MM. */
export function shiftMonth(key: string, delta: number): string {
  const [year, month] = key.split('-').map(Number);
  const d = new Date(Date.UTC(year, month - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

export const isMonthKey = (value: string) => /^\d{4}-(0[1-9]|1[0-2])$/.test(value);

const MONTH_TITLE = new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric', timeZone: 'UTC' });

/** "outubro de 2026" → "Outubro de 2026". */
export function monthTitle(key: string): string {
  const label = MONTH_TITLE.format(new Date(`${key}-01T00:00:00Z`));
  return label.charAt(0).toUpperCase() + label.slice(1);
}
