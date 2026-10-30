import type { Tone } from '@/lib/tones';

export type TransactionType = 'income' | 'expense';

export type PaymentMethod =
  | 'cash'
  | 'debit'
  | 'credit_card'
  | 'pix'
  | 'bank_transfer';

export type Transaction = {
  id: string;
  description: string;
  amount: number;
  type: TransactionType;
  category: string;
  paymentMethod: PaymentMethod;
  creditCardId?: string | null;
  date: string;
  isFixed: boolean;
  isPaid: boolean;
};

export type CreditCard = {
  id: string;
  name: string;
  limit: number;
  closingDay: number;
  dueDay: number;
  currentInvoiceAmount: number;
};

export type Currency = 'BRL' | 'USD';

export type SavingsGoal = {
  id: string;
  name: string;
  targetAmount: number;
  currentAmount: number; // na moeda da caixinha (currency)
  deadline?: string | null;
  institution?: string | null; // Ex: Inter, Mercado Pago
  cdiPercent?: number | null; // Rendimento em % do CDI, ex: 82, 120
  currency: Currency;
  lockDays?: number | null; // Prazo de resgate (ex: 7, 30, 90 dias no porquinho em dólar)
  depositDate?: string | null; // Último depósito, para calcular o resgate provável
  monthlyContribution?: number | null; // Aporte planejado por mês, para projetar quando a meta é batida
};

export type ListType = 'household' | 'wishlist';

export type ShoppingItem = {
  id: string;
  name: string;
  listType: ListType;
  estimatedPrice?: number | null;
  priority?: 'low' | 'medium' | 'high';
  isPurchased: boolean;
};

/** Categoria criada pelo usuário; as padrão (Alimentação, Moradia…) ficam em lib/finance.ts. */
export type Category = {
  id: string;
  name: string;
  emoji: string;
  tone: Tone;
};

// 'scr' = Relatório de Empréstimos e Financiamentos do Registrato (Banco Central); 'serasa' = negativações;
// 'manual' = cadastrada pelo usuário (empréstimos pessoais, acertos com pessoas).
export type DebtSource = 'scr' | 'serasa' | 'manual';

/** Origens que chegam por relatório importado (cada importação substitui a anterior da mesma origem). */
export type ReportDebtSource = Exclude<DebtSource, 'manual'>;

/** Situação que o usuário controla; define se a dívida entra no dashboard (ver AppSettings). */
export type DebtStatus = 'active' | 'awaiting_offer' | 'negotiated' | 'abandoned' | 'paid';

export type Debt = {
  id: string;
  creditor: string; // Instituição credora, ex: "BANCO SANTANDER (BRASIL) S.A."
  description: string; // Modalidade, ex: "Crédito pessoal - com consignação em folha de pagamento"
  source: DebtSource;
  currentAmount: number; // Em dia (não vencida ou vencida há até 14 dias)
  overdueAmount: number; // Vencida
  referenceDate: string; // ISO YYYY-MM-DD — mês de referência do SCR (dia 01) ou data da negativação
  status: DebtStatus;
  notes?: string | null; // Ex: "Oferta de R$ 800 à vista no Serasa Limpa Nome"
};

export type AppSettings = {
  /** Status de dívida que entram nos totais e no card de dívidas do dashboard. */
  dashboardDebtStatuses: DebtStatus[];
};

export type TransactionDraft = Omit<Transaction, 'id' | 'isPaid'> & {
  isPaid?: boolean;
};

export type FinanceSnapshot = {
  transactions: Transaction[];
  creditCards: CreditCard[];
  savingsGoals: SavingsGoal[];
  shoppingItems: ShoppingItem[];
  debts: Debt[];
  categories: Category[];
  settings: AppSettings;
};

// ---------- Importação de arquivos ----------

export type StatementFileFormat = 'ofx' | 'csv' | 'pdf';

/** Linha de extrato ainda não salva: o usuário revisa, edita e escolhe quais entram. */
export type StatementEntry = {
  description: string;
  amount: number;
  type: TransactionType;
  date: string;
  category: string;
  paymentMethod: Exclude<PaymentMethod, 'credit_card'>;
};

export type StatementPreview = {
  kind: 'statement';
  format: StatementFileFormat;
  entries: StatementEntry[];
  warnings: string[];
};

/** Linha lida de um relatório: status e anotações são do usuário, não do relatório. */
export type DebtEntry = Omit<Debt, 'id' | 'source' | 'status' | 'notes'>;

export type DebtReportPreview = {
  kind: 'debts';
  source: ReportDebtSource;
  entries: DebtEntry[];
  warnings: string[];
};

export type ImportPreview = StatementPreview | DebtReportPreview;

export type ChatExtraction = {
  transaction: TransactionDraft;
  confidence: 'low' | 'medium' | 'high';
  notes?: string;
};
