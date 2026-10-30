import { boolean, date, integer, jsonb, numeric, pgTable, text, timestamp } from 'drizzle-orm/pg-core';

import type { Tone } from '@/lib/tones';
import type {
  Currency,
  DebtSource,
  DebtStatus,
  ListType,
  PaymentMethod,
  TransactionType,
} from '@/types/finance';

// IDs são text (não uuid) porque os dados antigos do localStorage podem ter IDs no formato "id-<timestamp>-<random>".
// createdAt existe só para ordenar as listas do jeito que o store já ordenava.

const money = (name: string) => numeric(name, { precision: 14, scale: 2, mode: 'number' });

export const creditCards = pgTable('credit_cards', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  limit: money('limit').notNull(),
  closingDay: integer('closing_day').notNull(),
  dueDay: integer('due_day').notNull(),
  currentInvoiceAmount: money('current_invoice_amount').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const transactions = pgTable('transactions', {
  id: text('id').primaryKey(),
  description: text('description').notNull(),
  amount: money('amount').notNull(),
  type: text('type').$type<TransactionType>().notNull(),
  category: text('category').notNull(),
  paymentMethod: text('payment_method').$type<PaymentMethod>().notNull(),
  creditCardId: text('credit_card_id').references(() => creditCards.id, { onDelete: 'set null' }),
  date: date('date', { mode: 'string' }).notNull(),
  isFixed: boolean('is_fixed').notNull().default(false),
  isPaid: boolean('is_paid').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const savingsGoals = pgTable('savings_goals', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  targetAmount: money('target_amount').notNull(),
  currentAmount: money('current_amount').notNull().default(0),
  deadline: date('deadline', { mode: 'string' }),
  institution: text('institution'),
  cdiPercent: numeric('cdi_percent', { precision: 6, scale: 2, mode: 'number' }),
  currency: text('currency').$type<Currency>().notNull().default('BRL'),
  lockDays: integer('lock_days'),
  depositDate: date('deposit_date', { mode: 'string' }),
  monthlyContribution: money('monthly_contribution'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

// Cada importação de relatório substitui as dívidas da mesma origem: o SCR e o Serasa são fotos do mês, não histórico.
export const debts = pgTable('debts', {
  id: text('id').primaryKey(),
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
});

// Preferências do app (chave → JSON), compartilhadas entre aparelhos.
export const settings = pgTable('settings', {
  key: text('key').primaryKey(),
  value: jsonb('value').notNull(),
});

// Categorias do usuário. As transações guardam o NOME (texto), então apagar uma categoria não
// apaga lançamentos: eles só voltam a aparecer com o visual de "Outros".
export const categories = pgTable('categories', {
  id: text('id').primaryKey(),
  name: text('name').notNull().unique(),
  emoji: text('emoji').notNull(),
  tone: text('tone').$type<Tone>().notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

// Conta do usuário único (linha id = 'owner'). Fica fora de `settings` porque o snapshot de
// settings vai para o navegador, e o hash da senha nunca pode ir. Sem linha ou sem hash, o login
// usa APP_PASSWORD do env até a primeira troca de senha.
export const account = pgTable('account', {
  id: text('id').primaryKey(),
  email: text('email'),
  passwordHash: text('password_hash'),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const shoppingItems = pgTable('shopping_items', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  listType: text('list_type').$type<ListType>().notNull(),
  estimatedPrice: money('estimated_price'),
  priority: text('priority').$type<'low' | 'medium' | 'high'>(),
  isPurchased: boolean('is_purchased').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});
