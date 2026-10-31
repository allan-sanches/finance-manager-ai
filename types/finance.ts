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
  bankAccountId?: string | null; // Tag do banco (Inter, Mercado Pago, Santander…)
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
  // Limite garantido por investimento (ex: CDB do Inter): o limite passa a ser o saldo da caixinha.
  limitSavingsGoalId?: string | null;
};

/**
 * Fatura de um cartão, com as datas digitadas pelo usuário (os bancos mudam o fechamento de mês a mês).
 * Pagar a fatura (paymentDate preenchida) desconta o valor de currentInvoiceAmount e libera o limite.
 */
export type CreditCardInvoice = {
  id: string;
  creditCardId: string;
  closingDate: string; // ISO YYYY-MM-DD
  dueDate: string; // ISO YYYY-MM-DD
  amount: number;
  paymentDate?: string | null; // ISO YYYY-MM-DD; vazia = em aberto
};

/**
 * Conta corrente/carteira (Inter, Mercado Pago…). O saldo é o que o usuário informa olhando o app
 * do banco; balanceDate diz quando foi a última atualização.
 */
export type BankAccount = {
  id: string;
  name: string;
  balance: number;
  balanceDate: string; // ISO YYYY-MM-DD
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
  annualRate?: number | null; // Rendimento fixo em % a.a. das caixinhas em dólar, ex: 3.7
  currency: Currency;
  lockDays?: number | null; // Prazo de resgate (ex: 7, 30, 90 dias no porquinho em dólar)
  depositDate?: string | null; // Último depósito, para calcular o resgate provável
  monthlyContribution?: number | null; // Aporte planejado por mês, para projetar quando a meta é batida
  timeDeposits?: TimeDeposit[]; // Parte do saldo aplicada com vencimento (ex.: porquinhos em time deposit)
};

export type TimeDeposit = {
  id: string;
  amount: number; // na moeda da caixinha
  maturityDate: string; // ISO YYYY-MM-DD
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

/**
 * Id da situação da dívida. As situações são do usuário (AppSettings.debtStatuses): ele renomeia,
 * cria e apaga. As padrão usam ids fixos ('active', 'awaiting_offer', 'negotiated', 'abandoned', 'paid').
 */
export type DebtStatus = string;

export type DebtStatusOption = {
  id: DebtStatus;
  label: string; // Ex: "Abandonada", "Em negociação"
  tone: Tone;
};

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
  /** Situações de dívida, na ordem em que aparecem. 'active' é a de dívidas novas e não pode ser apagada. */
  debtStatuses: DebtStatusOption[];
};

export type TransactionDraft = Omit<Transaction, 'id' | 'isPaid'> & {
  isPaid?: boolean;
};

export type FinanceSnapshot = {
  transactions: Transaction[];
  creditCards: CreditCard[];
  creditCardInvoices: CreditCardInvoice[];
  bankAccounts: BankAccount[];
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

/** Lançamento lido de uma fatura de cartão: vira transação no crédito daquele cartão se o usuário marcar. */
export type InvoiceEntry = Omit<StatementEntry, 'paymentMethod'>;

/** Dados de uma fatura de cartão lidos de print ou PDF, para preencher o formulário de fatura. */
export type InvoicePreview = {
  kind: 'invoice';
  closingDate: string | null; // ISO YYYY-MM-DD
  dueDate: string | null; // ISO YYYY-MM-DD
  amount: number | null; // Total a pagar
  entries: InvoiceEntry[];
  warnings: string[];
};

export type ChatExtraction = {
  transaction: TransactionDraft;
  confidence: 'low' | 'medium' | 'high';
  notes?: string;
};
