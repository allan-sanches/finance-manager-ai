import { normalizeCategoryName } from '@/lib/tones';
import type {
  AppSettings,
  BankAccount,
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

/** Cartões de limite garantido: a compra conta no dia, a fatura não pesa de novo. */
export type SecuredCards = ReadonlySet<string>;
const NO_SECURED: SecuredCards = new Set();

export const securedCardIds = (cards: ReadonlyArray<Pick<CreditCard, 'id' | 'securedLimit'>>): SecuredCards =>
  new Set(cards.filter((c) => c.securedLimit).map((c) => c.id));

/**
 * Compra no cartão que só pesa no saldo quando a fatura é paga. Em cartão de limite garantido
 * a compra já conta como gasto no dia (e a fatura vira movimentação), então não entra aqui.
 */
export const paidByInvoice = (
  tx: Pick<Transaction, 'paymentMethod' | 'creditCardId'>,
  secured: SecuredCards = NO_SECURED,
): boolean => isCardPurchase(tx) && !(tx.creditCardId && secured.has(tx.creditCardId));

/** Movimentação (entre contas, para/da caixinha): o dinheiro continua seu, então não é entrada nem saída. */
export const isTransfer = (tx: Pick<Transaction, 'isTransfer'>): boolean => Boolean(tx.isTransfer);

/**
 * Quanto saiu das caixinhas/investimentos para as contas no mês (resgates menos aplicações).
 * Positivo = o mês usou dinheiro guardado; negativo = guardou mais do que tirou.
 */
export function savingsDrawdown(
  transactions: ReadonlyArray<Pick<Transaction, 'date' | 'type' | 'amount' | 'isTransfer' | 'savingsGoalId' | 'category'>>,
  key: string = currentMonthKey(),
): number {
  let net = 0;
  for (const tx of transactions) {
    if (!tx.isTransfer || !isSameMonth(tx.date, key)) continue;
    if (!tx.savingsGoalId && tx.category !== 'Investimentos') continue;
    net += tx.type === 'income' ? tx.amount : -tx.amount;
  }
  return Math.round(net * 100) / 100;
}

/**
 * Saldo de hoje da conta: o último saldo informado mais o que entrou e saiu dela depois daquela data
 * (lançamentos com a tag do banco, já pagos). Compra no cartão não mexe na conta; movimentação sim.
 */
export function accountBalance(
  account: Pick<BankAccount, 'id' | 'balance' | 'balanceDate'>,
  transactions: ReadonlyArray<
    Pick<Transaction, 'bankAccountId' | 'date' | 'isPaid' | 'paymentMethod' | 'type' | 'amount'>
  >,
): { balance: number; after: number } {
  let balance = account.balance;
  let after = 0;
  for (const tx of transactions) {
    if (tx.bankAccountId !== account.id || tx.date <= account.balanceDate || !tx.isPaid) continue;
    if (isCardPurchase(tx)) continue;
    balance += tx.type === 'income' ? tx.amount : -tx.amount;
    after += 1;
  }
  return { balance: Math.round(balance * 100) / 100, after };
}

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
 * Faturas futuras já lançadas (parcelas que vão cair em jan, fev…) ocupam o limite, mas não
 * "engolem" as compras novas: o corte é o fechamento da fatura atual (a primeira que ainda vai fechar).
 */
export function cardUsage(
  cardId: string,
  transactions: ReadonlyArray<Pick<Transaction, 'paymentMethod' | 'creditCardId' | 'date' | 'amount' | 'type'>>,
  invoices: ReadonlyArray<Pick<CreditCardInvoice, 'creditCardId' | 'closingDate' | 'amount' | 'paymentDate'>>,
  today: string = todayISO(),
): CardUsage {
  let lastPastClosing: string | null = null;
  let nextClosing: string | null = null;
  let openInvoices = 0;
  for (const i of invoices) {
    if (i.creditCardId !== cardId) continue;
    if (i.closingDate < today) {
      if (!lastPastClosing || i.closingDate > lastPastClosing) lastPastClosing = i.closingDate;
    } else if (!nextClosing || i.closingDate < nextClosing) {
      nextClosing = i.closingDate;
    }
    if (!i.paymentDate) openInvoices += i.amount;
  }
  const lastClosingDate = nextClosing ?? lastPastClosing;
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
 * (aparecem como "Vencida" na tela de cartões). Faturas de cartão de limite garantido ficam de fora:
 * as compras já contaram no dia.
 */
export function invoiceOutflows(
  invoices: ReadonlyArray<Pick<CreditCardInvoice, 'creditCardId' | 'dueDate' | 'amount' | 'paymentDate'>>,
  today: string = todayISO(),
  secured: SecuredCards = NO_SECURED,
): { realized: InvoicePayment[]; expected: InvoicePayment[] } {
  const realized: InvoicePayment[] = [];
  const expected: InvoicePayment[] = [];
  for (const i of invoices) {
    if (i.amount <= 0 || secured.has(i.creditCardId)) continue;
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
 * da fatura (`payments`), no mês em que foi pago. Em cartão de limite garantido (`secured`) é o
 * contrário: a compra conta no dia.
 */
export function summarizeMonth(
  transactions: ReadonlyArray<Transaction>,
  key: string = currentMonthKey(),
  payments: ReadonlyArray<InvoicePayment> = [],
  secured: SecuredCards = NO_SECURED,
): MonthlySummary {
  let income = 0;
  let expense = 0;
  for (const tx of transactions) {
    if (!isSameMonth(tx.date, key) || paidByInvoice(tx, secured) || isTransfer(tx)) continue;
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
  secured: SecuredCards = NO_SECURED,
): CashflowPoint[] {
  const now = new Date();
  const points: CashflowPoint[] = [];
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const summary = summarizeMonth(transactions, key, payments, secured);
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
    if (tx.type !== 'expense' || isTransfer(tx)) continue;
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
