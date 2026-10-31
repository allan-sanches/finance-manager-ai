import { isTransfer, monthKey, paidByInvoice, type InvoicePayment, type SecuredCards } from '@/lib/finance';
import type { Transaction } from '@/types/finance';

/** Lançamento de dívida: despesa na categoria "Dívidas" (parcela de empréstimo, acordo etc.). */
export function isDebtPayment(tx: Transaction): boolean {
  if (tx.type !== 'expense' || isTransfer(tx)) return false;
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
  expense: number; // Sem as dívidas e sem compras no cartão
  debt: number;
  card: number; // Compras no cartão: só saem do saldo quando a fatura é paga
  invoices: number; // Faturas pagas (ou a pagar, no previsto)
  moved: number; // Movimentações entre contas/caixinhas: registradas, fora do saldo
  balance: number;
  count: number;
  openCount: number; // Ainda não pagos/recebidos
};

/**
 * `payments`: faturas pagas/a pagar do mês (ver invoiceOutflows). `secured`: cartões de limite
 * garantido, cujas compras contam como receita/despesa no dia em vez de esperar a fatura.
 */
export function totalsOf(
  key: string,
  transactions: ReadonlyArray<Transaction>,
  payments: ReadonlyArray<InvoicePayment> = [],
  secured?: SecuredCards,
): MonthTotals {
  const totals: MonthTotals = {
    key,
    income: 0,
    expense: 0,
    debt: 0,
    card: 0,
    invoices: 0,
    moved: 0,
    balance: 0,
    count: 0,
    openCount: 0,
  };
  for (const tx of transactions) {
    if (isTransfer(tx)) totals.moved += tx.amount;
    else if (paidByInvoice(tx, secured)) totals.card += tx.type === 'income' ? -tx.amount : tx.amount;
    else if (tx.type === 'income') totals.income += tx.amount;
    else if (isDebtPayment(tx)) totals.debt += tx.amount;
    else totals.expense += tx.amount;
    totals.count += 1;
    if (!tx.isPaid) totals.openCount += 1;
  }
  for (const p of payments) totals.invoices += p.amount;
  totals.balance = totals.income - totals.expense - totals.debt - totals.invoices;
  return totals;
}

/** Totais por mês; `order` 'desc' para o histórico (mais recente primeiro), 'asc' para o previsto. */
export function groupByMonth(
  transactions: ReadonlyArray<Transaction>,
  order: 'asc' | 'desc' = 'desc',
  payments: ReadonlyArray<InvoicePayment> = [],
  secured?: SecuredCards,
): MonthTotals[] {
  const groups = new Map<string, { rows: Transaction[]; payments: InvoicePayment[] }>();
  const group = (key: string) => {
    let g = groups.get(key);
    if (!g) groups.set(key, (g = { rows: [], payments: [] }));
    return g;
  };
  for (const tx of transactions) group(monthKey(tx.date)).rows.push(tx);
  for (const p of payments) group(monthKey(p.date)).payments.push(p);
  const months = [...groups.entries()].map(([key, g]) => totalsOf(key, g.rows, g.payments, secured));
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
