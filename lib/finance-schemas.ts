import { z } from 'zod';

import { TONES } from '@/lib/tones';

// Validação das entradas das Server Actions e da importação do localStorage.
// Espelha os DTOs de types/finance.ts; as Server Actions são endpoints públicos, então nada chega ao banco sem passar aqui.

const id = z.string().trim().min(1).max(100);
const money = z.number().finite().min(0).max(1_000_000_000_000);
const positiveMoney = money.positive();
const isoDate = z.iso.date();
const shortText = z.string().trim().min(1).max(200);

export const transactionSchema = z.object({
  id,
  description: shortText,
  amount: positiveMoney,
  type: z.enum(['income', 'expense']),
  category: z.string().trim().min(1).max(80),
  paymentMethod: z.enum(['cash', 'debit', 'credit_card', 'pix', 'bank_transfer']),
  creditCardId: id.nullish().transform((v) => v ?? null),
  date: isoDate,
  isFixed: z.boolean(),
  isPaid: z.boolean(),
});

export const transactionPatchSchema = transactionSchema.omit({ id: true }).partial();

const day = z.number().int().min(1).max(31);

export const creditCardSchema = z.object({
  id,
  name: z.string().trim().min(1).max(80),
  limit: money,
  closingDay: day,
  dueDay: day,
  currentInvoiceAmount: money,
});

export const creditCardPatchSchema = creditCardSchema
  .omit({ id: true, currentInvoiceAmount: true })
  .partial();

export const savingsGoalSchema = z.object({
  id,
  name: z.string().trim().min(1).max(80),
  targetAmount: positiveMoney,
  currentAmount: money,
  deadline: isoDate.nullish().transform((v) => v ?? null),
});

export const savingsGoalPatchSchema = savingsGoalSchema
  .omit({ id: true, currentAmount: true })
  .partial();

export const shoppingItemSchema = z.object({
  id,
  name: shortText,
  listType: z.enum(['household', 'wishlist']),
  estimatedPrice: money.nullish().transform((v) => v ?? null),
  priority: z.enum(['low', 'medium', 'high']).optional(),
  isPurchased: z.boolean(),
});

export const shoppingItemPatchSchema = shoppingItemSchema.omit({ id: true }).partial();

export const categorySchema = z.object({
  id,
  name: z.string().trim().min(1).max(40),
  // Um emoji pode ter vários code points (pele, ZWJ, bandeiras): limita por tamanho, não por 1 caractere.
  emoji: z.string().trim().min(1).max(16),
  tone: z.enum(TONES),
});

export const debtSourceSchema = z.enum(['scr', 'serasa', 'manual']);

export const debtSchema = z
  .object({
    id,
    creditor: shortText,
    description: shortText,
    source: debtSourceSchema,
    currentAmount: money,
    overdueAmount: money,
    referenceDate: isoDate,
  })
  .refine((d) => d.currentAmount + d.overdueAmount > 0, 'Dívida sem valor.');

export const idSchema = id;
export const amountSchema = positiveMoney;

const MAX_IMPORT_ROWS = 20_000;

export const transactionBatchSchema = z.array(transactionSchema).min(1).max(MAX_IMPORT_ROWS);
export const debtBatchSchema = z.array(debtSchema).max(MAX_IMPORT_ROWS);

export const snapshotSchema = z.object({
  transactions: z.array(transactionSchema).max(MAX_IMPORT_ROWS).default([]),
  creditCards: z.array(creditCardSchema).max(MAX_IMPORT_ROWS).default([]),
  savingsGoals: z.array(savingsGoalSchema).max(MAX_IMPORT_ROWS).default([]),
  shoppingItems: z.array(shoppingItemSchema).max(MAX_IMPORT_ROWS).default([]),
  debts: z.array(debtSchema).max(MAX_IMPORT_ROWS).default([]),
  categories: z.array(categorySchema).max(MAX_IMPORT_ROWS).default([]),
});

export type SnapshotInput = z.infer<typeof snapshotSchema>;
