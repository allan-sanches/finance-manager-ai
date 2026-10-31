import {
  boolean,
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
} from 'drizzle-orm/pg-core';

import type { Tone } from '@/lib/tones';
import type {
  Currency,
  DebtSource,
  DebtStatus,
  ListType,
  PaymentMethod,
  TimeDeposit,
  TransactionType,
} from '@/types/finance';

// IDs são text (não uuid) porque os dados antigos do localStorage podem ter IDs no formato "id-<timestamp>-<random>".
// createdAt existe só para ordenar as listas do jeito que o store já ordenava.

const money = (name: string) => numeric(name, { precision: 14, scale: 2, mode: 'number' });

// Pessoas com acesso ao app. A conta original é a linha id = 'owner' (admin), dona dos dados que
// existiam antes do multiusuário. Fica fora de `settings` porque o snapshot vai para o navegador, e
// o hash da senha nunca pode ir. Owner sem hash entra com APP_PASSWORD do env até a primeira troca.
export const users = pgTable('users', {
  id: text('id').primaryKey(),
  // Sempre minúsculo. Nulo só no owner que ainda não cadastrou e-mail (ver authenticate).
  email: text('email').unique(),
  passwordHash: text('password_hash'),
  isAdmin: boolean('is_admin').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// Toda linha de dado tem dono; apagar o usuário apaga os dados dele.
const userId = () =>
  text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' });

export const creditCards = pgTable('credit_cards', {
  id: text('id').primaryKey(),
  userId: userId(),
  name: text('name').notNull(),
  limit: money('limit').notNull(),
  closingDay: integer('closing_day').notNull(),
  dueDay: integer('due_day').notNull(),
  currentInvoiceAmount: money('current_invoice_amount').notNull().default(0),
  // Sem FK: a importação do localStorage insere cartões antes das caixinhas. Caixinha inexistente
  // faz o cartão voltar para o `limit` salvo (ver cardLimit).
  limitSavingsGoalId: text('limit_savings_goal_id'),
  // Limite garantido (ex: CDB do Inter): a compra conta como gasto no dia; pagar a fatura só devolve o limite.
  securedLimit: boolean('secured_limit').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index('credit_cards_user_id_idx').on(t.userId)]);

// Apagar o cartão apaga as faturas dele.
export const creditCardInvoices = pgTable('credit_card_invoices', {
  id: text('id').primaryKey(),
  userId: userId(),
  creditCardId: text('credit_card_id')
    .notNull()
    .references(() => creditCards.id, { onDelete: 'cascade' }),
  closingDate: date('closing_date', { mode: 'string' }).notNull(),
  dueDate: date('due_date', { mode: 'string' }).notNull(),
  amount: money('amount').notNull(),
  paymentDate: date('payment_date', { mode: 'string' }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index('credit_card_invoices_user_id_idx').on(t.userId)]);

// Saldo informado à mão pelo usuário (não é calculado a partir das transações).
export const bankAccounts = pgTable('bank_accounts', {
  id: text('id').primaryKey(),
  userId: userId(),
  name: text('name').notNull(),
  balance: money('balance').notNull().default(0),
  balanceDate: date('balance_date', { mode: 'string' }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index('bank_accounts_user_id_idx').on(t.userId)]);

export const transactions = pgTable('transactions', {
  id: text('id').primaryKey(),
  userId: userId(),
  description: text('description').notNull(),
  amount: money('amount').notNull(),
  type: text('type').$type<TransactionType>().notNull(),
  category: text('category').notNull(),
  paymentMethod: text('payment_method').$type<PaymentMethod>().notNull(),
  creditCardId: text('credit_card_id').references(() => creditCards.id, { onDelete: 'set null' }),
  // Tag do banco (Inter, Mercado Pago…) para separar as transações por conta.
  bankAccountId: text('bank_account_id').references(() => bankAccounts.id, { onDelete: 'set null' }),
  // Movimentação: dinheiro que só muda de lugar (entre contas, para/da caixinha). Fica fora de
  // entradas e saídas. savingsGoalId diz para qual caixinha foi (ou de qual saiu).
  isTransfer: boolean('is_transfer').notNull().default(false),
  savingsGoalId: text('savings_goal_id').references(() => savingsGoals.id, { onDelete: 'set null' }),
  date: date('date', { mode: 'string' }).notNull(),
  isFixed: boolean('is_fixed').notNull().default(false),
  isPaid: boolean('is_paid').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index('transactions_user_id_idx').on(t.userId)]);

export const savingsGoals = pgTable('savings_goals', {
  id: text('id').primaryKey(),
  userId: userId(),
  name: text('name').notNull(),
  targetAmount: money('target_amount').notNull(),
  currentAmount: money('current_amount').notNull().default(0),
  deadline: date('deadline', { mode: 'string' }),
  institution: text('institution'),
  cdiPercent: numeric('cdi_percent', { precision: 6, scale: 2, mode: 'number' }),
  annualRate: numeric('annual_rate', { precision: 6, scale: 2, mode: 'number' }),
  // Aplicações com vencimento dentro da caixinha (ex.: porquinhos de time deposit). Fazem parte
  // do currentAmount; servem só para avisar quando cada uma vence.
  timeDeposits: jsonb('time_deposits').$type<TimeDeposit[]>().notNull().default([]),
  currency: text('currency').$type<Currency>().notNull().default('BRL'),
  lockDays: integer('lock_days'),
  depositDate: date('deposit_date', { mode: 'string' }),
  monthlyContribution: money('monthly_contribution'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index('savings_goals_user_id_idx').on(t.userId)]);

// Cada importação de relatório substitui as dívidas da mesma origem: o SCR e o Serasa são fotos do mês, não histórico.
export const debts = pgTable('debts', {
  id: text('id').primaryKey(),
  userId: userId(),
  creditor: text('creditor').notNull(),
  description: text('description').notNull(),
  source: text('source').$type<DebtSource>().notNull(),
  currentAmount: money('current_amount').notNull().default(0),
  overdueAmount: money('overdue_amount').notNull().default(0),
  referenceDate: date('reference_date', { mode: 'string' }).notNull(),
  // Status e anotações são do usuário: sobrevivem quando um relatório novo substitui as linhas.
  status: text('status').$type<DebtStatus>().notNull().default('active'),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index('debts_user_id_idx').on(t.userId)]);

// Preferências do app (chave → JSON) de cada usuário, compartilhadas entre os aparelhos dele.
export const settings = pgTable(
  'settings',
  {
    userId: userId(),
    key: text('key').notNull(),
    value: jsonb('value').notNull(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.key] })],
);

// Categorias do usuário. As transações guardam o NOME (texto), então apagar uma categoria não
// apaga lançamentos: eles só voltam a aparecer com o visual de "Outros".
export const categories = pgTable('categories', {
  id: text('id').primaryKey(),
  userId: userId(),
  name: text('name').notNull(),
  emoji: text('emoji').notNull(),
  tone: text('tone').$type<Tone>().notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [unique('categories_user_id_name_unique').on(t.userId, t.name)]);

export const shoppingItems = pgTable('shopping_items', {
  id: text('id').primaryKey(),
  userId: userId(),
  name: text('name').notNull(),
  listType: text('list_type').$type<ListType>().notNull(),
  estimatedPrice: money('estimated_price'),
  priority: text('priority').$type<'low' | 'medium' | 'high'>(),
  isPurchased: boolean('is_purchased').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index('shopping_items_user_id_idx').on(t.userId)]);
