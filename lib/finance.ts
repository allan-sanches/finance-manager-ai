import { normalizeCategoryName } from '@/lib/tones';
import type {
  AppSettings,
  CreditCard,
  CreditCardInvoice,
  Debt,
  DebtSource,
  DebtStatus,
  DebtStatusOption,
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

/** Situação das dívidas novas (cadastro manual e importação). Pode ser renomeada, não apagada. */
export const DEFAULT_DEBT_STATUS: DebtStatus = 'active';

export const DEFAULT_DEBT_STATUSES: DebtStatusOption[] = [
  { id: 'active', label: 'Em aberto', tone: 'amber' },
  { id: 'awaiting_offer', label: 'Aguardando oferta', tone: 'cyan' },
  { id: 'negotiated', label: 'Negociada', tone: 'violet' },
  { id: 'abandoned', label: 'Abandonada', tone: 'slate' },
  { id: 'paid', label: 'Quitada', tone: 'mint' },
];

/** Abandonadas e quitadas ficam fora do dashboard até o usuário mudar a preferência. */
export const DEFAULT_SETTINGS: AppSettings = {
  dashboardDebtStatuses: ['active', 'awaiting_offer', 'negotiated'],
  debtStatuses: DEFAULT_DEBT_STATUSES,
};

/** Situação pelo id; id que não existe mais (apagada em outro aparelho) aparece com o próprio id, em cinza. */
export function debtStatusOption(settings: Pick<AppSettings, 'debtStatuses'>, id: DebtStatus): DebtStatusOption {
  return settings.debtStatuses.find((s) => s.id === id) ?? { id, label: id, tone: 'slate' };
}

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

/** Compra no cartão não sai da conta na hora: o dinheiro só sai quando a fatura é paga. */
export const isCardPurchase = (tx: Pick<Transaction, 'paymentMethod'>): boolean =>
  tx.paymentMethod === 'credit_card';

export type CardUsage = {
  /** Compras feitas a partir do último fechamento: ainda não entraram em nenhuma fatura. */
  unbilled: number;
  /** Faturas lançadas e ainda não pagas. */
  openInvoices: number;
  /** O que ocupa o limite: faturas em aberto + compras ainda não faturadas. */
  used: number;
  lastClosingDate: string | null;
};

/**
 * Uso do limite do cartão. O valor da fatura (digitado ou lido do PDF) manda no período dela:
 * compras com data antes do último fechamento já estão dentro de alguma fatura e não contam de novo.
 * Compra no dia do fechamento já cai na fatura seguinte (é o "melhor dia de compra").
 */
export function cardUsage(
  cardId: string,
  transactions: ReadonlyArray<Pick<Transaction, 'paymentMethod' | 'creditCardId' | 'date' | 'amount' | 'type'>>,
  invoices: ReadonlyArray<Pick<CreditCardInvoice, 'creditCardId' | 'closingDate' | 'amount' | 'paymentDate'>>,
): CardUsage {
  let lastClosingDate: string | null = null;
  let openInvoices = 0;
  for (const i of invoices) {
    if (i.creditCardId !== cardId) continue;
    if (!lastClosingDate || i.closingDate > lastClosingDate) lastClosingDate = i.closingDate;
    if (!i.paymentDate) openInvoices += i.amount;
  }
  let unbilled = 0;
  for (const tx of transactions) {
    if (!isCardPurchase(tx) || tx.creditCardId !== cardId) continue;
    if (lastClosingDate && tx.date < lastClosingDate) continue;
    // Receita no cartão é estorno: abate da fatura.
    unbilled += tx.type === 'income' ? -tx.amount : tx.amount;
  }
  unbilled = Math.max(0, Math.round(unbilled * 100) / 100);
  return { unbilled, openInvoices, used: unbilled + openInvoices, lastClosingDate };
}

/** Saída da conta por pagamento de fatura (na data do pagamento, ou do vencimento se ainda está prevista). */
export type InvoicePayment = { date: string; amount: number };

/**
 * Faturas como saídas da conta: pagas entram como realizado na data do pagamento; em aberto que
 * ainda vão vencer entram como previsto no vencimento. Vencidas sem pagamento ficam de fora
 * (aparecem como "Vencida" na tela de cartões).
 */
export function invoiceOutflows(
  invoices: ReadonlyArray<Pick<CreditCardInvoice, 'dueDate' | 'amount' | 'paymentDate'>>,
  today: string = todayISO(),
): { realized: InvoicePayment[]; expected: InvoicePayment[] } {
  const realized: InvoicePayment[] = [];
  const expected: InvoicePayment[] = [];
  for (const i of invoices) {
    if (i.amount <= 0) continue;
    if (i.paymentDate) (i.paymentDate > today ? expected : realized).push({ date: i.paymentDate, amount: i.amount });
    else if (i.dueDate >= today) expected.push({ date: i.dueDate, amount: i.amount });
  }
  return { realized, expected };
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

/**
 * Entradas e saídas da conta no mês. Compras no cartão ficam de fora; o que sai é o pagamento
 * da fatura (`payments`), no mês em que foi pago.
 */
export function summarizeMonth(
  transactions: ReadonlyArray<Transaction>,
  key: string = currentMonthKey(),
  payments: ReadonlyArray<InvoicePayment> = [],
): MonthlySummary {
  let income = 0;
  let expense = 0;
  for (const tx of transactions) {
    if (!isSameMonth(tx.date, key) || isCardPurchase(tx)) continue;
    if (tx.type === 'income') income += tx.amount;
    else expense += tx.amount;
  }
  for (const p of payments) if (isSameMonth(p.date, key)) expense += p.amount;
  return { income, expense, balance: income - expense };
}

export type CashflowPoint = { mes: string; entradas: number; saidas: number };

export function cashflowLastMonths(
  transactions: ReadonlyArray<Transaction>,
  months: number = 6,
  payments: ReadonlyArray<InvoicePayment> = [],
): CashflowPoint[] {
  const now = new Date();
  const points: CashflowPoint[] = [];
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const summary = summarizeMonth(transactions, key, payments);
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
