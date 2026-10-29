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

export type SavingsGoal = {
  id: string;
  name: string;
  targetAmount: number;
  currentAmount: number;
  deadline?: string | null;
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

// 'scr' = Relatório de Empréstimos e Financiamentos do Registrato (Banco Central); 'serasa' = negativações;
// 'manual' = cadastrada pelo usuário (empréstimos pessoais, acertos com pessoas).
export type DebtSource = 'scr' | 'serasa' | 'manual';

/** Origens que chegam por relatório importado (cada importação substitui a anterior da mesma origem). */
export type ReportDebtSource = Exclude<DebtSource, 'manual'>;

export type Debt = {
  id: string;
  creditor: string; // Instituição credora, ex: "BANCO SANTANDER (BRASIL) S.A."
  description: string; // Modalidade, ex: "Crédito pessoal - com consignação em folha de pagamento"
  source: DebtSource;
  currentAmount: number; // Em dia (não vencida ou vencida há até 14 dias)
  overdueAmount: number; // Vencida
  referenceDate: string; // ISO YYYY-MM-DD — mês de referência do SCR (dia 01) ou data da negativação
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

export type DebtEntry = Omit<Debt, 'id' | 'source'>;

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
