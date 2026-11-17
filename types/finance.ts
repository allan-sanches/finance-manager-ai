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
  isTransfer?: boolean; // Movimentação (entre contas/caixinhas): fora de entradas e saídas
  savingsGoalId?: string | null; // Caixinha da movimentação: despesa = guardou, receita = tirou
  date: string;
  isFixed: boolean;
  isPaid: boolean;
  // Compra parcelada: cada parcela é uma transação na fatura em que cai (ver lib/installments.ts).
  installmentGroupId?: string | null;
  installmentNumber?: number | null;
  installmentCount?: number | null;
  createdAt?: string; // ISO timestamp do registro (só leitura): separa compra nova do valor já informado da fatura
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
  // Limite garantido: a compra conta como gasto no dia em que foi feita e o pagamento da fatura
  // é movimentação (devolve o limite). Sem isso, o gasto só pesa quando a fatura é paga.
  securedLimit?: boolean;
  // Dia em que `limit` foi conferido (YYYY-MM-DD). No limite garantido, movimentações ligadas ao
  // cartão depois dessa data mudam o limite: aplicação no CDB aumenta, resgate diminui.
  limitDate?: string | null;
  // Rendimento do investimento que garante o limite, em % do CDI (ex.: 100). Rende por dia útil.
  cdiPercent?: number | null;
  // Limite usado como o banco mostra, conferido em usedDate (YYYY-MM-DD). Daí em diante, compras
  // somam e faturas pagas descontam: juros de parcelas futuras não ocupam o limite.
  usedAmount?: number | null;
  usedDate?: string | null;
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
  recordedAt?: string; // ISO timestamp de quando o valor foi informado (só leitura, vem do servidor)
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
  amountDate?: string | null; // Dia em que currentAmount foi conferido: daí em diante rende por dia útil
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
  imageUrl?: string | null; // Foto do item: miniatura em data:image (enviada do aparelho) ou link https
  productUrl?: string | null; // Link da loja
  priceHistory?: PricePoint[]; // Preços anotados, do mais antigo ao mais novo; o último é o estimatedPrice
  priceCheckedAt?: string | null; // Última leitura automática do preço no productUrl (ISO date-time); só o servidor grava
  priceCheckError?: string | null; // Por que a última leitura automática falhou
};

/** Um preço visto em um dia, para acompanhar se o desejo ficou mais barato. */
export type PricePoint = {
  date: string; // ISO YYYY-MM-DD
  price: number;
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
  /** Categorias ocultas: os lançamentos delas somem das listas, gráficos e totais (não do saldo das contas). */
  hiddenCategories: string[];
  /** Como o app chama a pessoa nas saudações ("Bom dia, Ana"). Vazio = sem nome. */
  displayName: string;
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
  /** Movimentação (investimento, fatura, entre contas próprias): fora de entradas e saídas. */
  isTransfer?: boolean;
  /** "Pix no crédito": saiu da conta mas o banco cobrou no cartão; entra como compra no cartão. */
  paidByCard?: boolean;
  /** Aplicação/resgate do investimento que garante o cartão: liga ao cartão de limite garantido. */
  fundsCard?: boolean;
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
