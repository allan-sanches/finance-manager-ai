import { normalizeCategoryName } from '@/lib/tones';
import type {
  AppSettings,
  CreditCard,
  CreditCardInvoice,
  Debt,
  DebtSource,
  DebtStatus,
  PaymentMethod,
  SavingsGoal,
  Transaction,
  TransactionType,
} from '@/types/finance';

export const BRL = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
});

export const CATEGORIES: ReadonlyArray<string> = [
  'Alimentação',
  'Moradia',
  'Transporte',
  'Lazer',
  'Saúde',
  'Educação',
  'Salário',
  'Investimentos',
  'Assinaturas',
  'Dívidas',
  'Outros',
];

const OTHERS = 'Outros';

/** Categorias padrão + as do usuário, com "Outros" sempre por último. */
export function mergeCategoryNames(custom: ReadonlyArray<{ name: string }>): string[] {
  const builtIn = CATEGORIES.filter((c) => c !== OTHERS);
  const taken = new Set(builtIn.map(normalizeCategoryName));
  const own = custom
    .map((c) => c.name)
    .filter((name) => !taken.has(normalizeCategoryName(name)))
    .sort((a, b) => a.localeCompare(b, 'pt-BR'));
  return [...builtIn, ...own, OTHERS];
}

/**
 * Limite efetivo do cartão: se ele é garantido por uma caixinha em reais, vale o saldo dela;
 * senão (ou se a caixinha sumiu), o limite fixo cadastrado.
 */
export function cardLimit(
  card: Pick<CreditCard, 'limit' | 'limitSavingsGoalId'>,
  goals: ReadonlyArray<Pick<SavingsGoal, 'id' | 'currency' | 'currentAmount'>>,
): number {
  const goal = card.limitSavingsGoalId
    ? goals.find((g) => g.id === card.limitSavingsGoalId && g.currency === 'BRL')
    : undefined;
  return goal ? goal.currentAmount : card.limit;
}

/** Abandonadas e quitadas ficam fora do dashboard até o usuário mudar a preferência. */
export const DEFAULT_SETTINGS: AppSettings = {
  dashboardDebtStatuses: ['active', 'awaiting_offer', 'negotiated'],
};

export const DEBT_STATUS_LABEL: Record<DebtStatus, string> = {
  active: 'Em aberto',
  awaiting_offer: 'Aguardando oferta',
  negotiated: 'Negociada',
  abandoned: 'Abandonada',
  paid: 'Quitada',
};

export const DEBT_STATUSES = Object.keys(DEBT_STATUS_LABEL) as DebtStatus[];

/** Dívidas que entram nos totais do dashboard, conforme a preferência do usuário. */
export function debtsOnDashboard(debts: ReadonlyArray<Debt>, settings: AppSettings): Debt[] {
  return debts.filter((d) => settings.dashboardDebtStatuses.includes(d.status));
}

export const PAYMENT_METHOD_LABEL: Record<PaymentMethod, string> = {
  cash: 'Dinheiro',
  debit: 'Débito',
  credit_card: 'Cartão de crédito',
  pix: 'Pix',
  bank_transfer: 'Transferência',
};

export const TRANSACTION_TYPE_LABEL: Record<TransactionType, string> = {
  income: 'Receita',
  expense: 'Despesa',
};

export const DEBT_SOURCE_LABEL: Record<DebtSource, string> = {
  scr: 'Registrato (SCR)',
  serasa: 'Serasa',
  manual: 'Cadastro manual',
};

export type DebtSummary = { current: number; overdue: number; total: number };

export function summarizeDebts(debts: ReadonlyArray<Debt>): DebtSummary {
  let current = 0;
  let overdue = 0;
  for (const d of debts) {
    current += d.currentAmount;
    overdue += d.overdueAmount;
  }
  return { current, overdue, total: current + overdue };
}

export const MONTH_LABELS = [
  'Jan',
  'Fev',
  'Mar',
  'Abr',
  'Mai',
  'Jun',
  'Jul',
  'Ago',
  'Set',
  'Out',
  'Nov',
  'Dez',
] as const;

export const APP_TIME_ZONE = 'America/Sao_Paulo';

// en-CA formata como YYYY-MM-DD; toISOString() usaria UTC e viraria o dia após as 21h em Brasília.
const isoDateFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: APP_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

export function todayISO(now: Date = new Date()): string {
  return isoDateFormatter.format(now);
}

// Datas ISO são dias de calendário: formatar em UTC evita que meia-noite vire o dia anterior.
const SHORT_DATE = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', timeZone: 'UTC' });

/** "2026-11-05" → "05/11". */
export const shortDate = (dateISO: string): string => SHORT_DATE.format(new Date(`${dateISO}T00:00:00Z`));

export type InvoiceStatus = 'paid' | 'open' | 'overdue';

export function invoiceStatus(
  invoice: Pick<CreditCardInvoice, 'dueDate' | 'paymentDate'>,
  today: string = todayISO(),
): InvoiceStatus {
  if (invoice.paymentDate) return 'paid';
  return invoice.dueDate < today ? 'overdue' : 'open';
}

/** Fatura em aberto que vence primeiro (a que o usuário precisa pagar agora). */
export function nextOpenInvoice<T extends Pick<CreditCardInvoice, 'creditCardId' | 'dueDate' | 'paymentDate'>>(
  invoices: ReadonlyArray<T>,
  cardId: string,
): T | undefined {
  return invoices
    .filter((i) => i.creditCardId === cardId && !i.paymentDate)
    .reduce<T | undefined>((first, i) => (!first || i.dueDate < first.dueDate ? i : first), undefined);
}

export function monthKey(dateISO: string): string {
  return dateISO.slice(0, 7);
}

export function currentMonthKey(): string {
  return todayISO().slice(0, 7);
}

export function isSameMonth(dateISO: string, key: string): boolean {
  return monthKey(dateISO) === key;
}

export type MonthlySummary = {
  income: number;
  expense: number;
  balance: number;
};

export function summarizeMonth(
  transactions: ReadonlyArray<Transaction>,
  key: string = currentMonthKey(),
): MonthlySummary {
  let income = 0;
  let expense = 0;
  for (const tx of transactions) {
    if (!isSameMonth(tx.date, key)) continue;
    if (tx.type === 'income') income += tx.amount;
    else expense += tx.amount;
  }
  return { income, expense, balance: income - expense };
}

export type CashflowPoint = { mes: string; entradas: number; saidas: number };

export function cashflowLastMonths(
  transactions: ReadonlyArray<Transaction>,
  months: number = 6,
): CashflowPoint[] {
  const now = new Date();
  const points: CashflowPoint[] = [];
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const summary = summarizeMonth(transactions, key);
    points.push({
      mes: MONTH_LABELS[d.getMonth()],
      entradas: summary.income,
      saidas: summary.expense,
    });
  }
  return points;
}

export type CategorySlice = { name: string; value: number };

export function expensesByCategory(
  transactions: ReadonlyArray<Transaction>,
  key: string = currentMonthKey(),
): CategorySlice[] {
  const map = new Map<string, number>();
  for (const tx of transactions) {
    if (tx.type !== 'expense') continue;
    if (!isSameMonth(tx.date, key)) continue;
    map.set(tx.category, (map.get(tx.category) ?? 0) + tx.amount);
  }
  return Array.from(map.entries())
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);
}

export function classifyTransaction(
  tx: Transaction,
): 'fixed' | 'variable' | 'credit' | 'debt' {
  if (tx.paymentMethod === 'credit_card') return 'credit';
  if (tx.category.toLowerCase().includes('dívida') || tx.category.toLowerCase().includes('divida')) {
    return 'debt';
  }
  return tx.isFixed ? 'fixed' : 'variable';
}
