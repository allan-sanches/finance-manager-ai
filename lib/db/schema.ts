import { boolean, date, integer, numeric, pgTable, text, timestamp } from 'drizzle-orm/pg-core';

import type { Tone } from '@/lib/tones';
import type { DebtSource, ListType, PaymentMethod, TransactionType } from '@/types/finance';

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
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
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

export const shoppingItems = pgTable('shopping_items', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  listType: text('list_type').$type<ListType>().notNull(),
  estimatedPrice: money('estimated_price'),
  priority: text('priority').$type<'low' | 'medium' | 'high'>(),
  isPurchased: boolean('is_purchased').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});
