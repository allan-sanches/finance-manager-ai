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

const nullable = <T extends z.ZodType>(schema: T) => schema.nullish().transform((v) => v ?? null);

export const creditCardSchema = z.object({
  id,
  name: z.string().trim().min(1).max(80),
  limit: money,
  closingDay: day,
  dueDay: day,
  currentInvoiceAmount: money,
  limitSavingsGoalId: nullable(id),
});

export const creditCardPatchSchema = creditCardSchema
  .omit({ id: true, currentInvoiceAmount: true })
  .partial();

export const creditCardInvoiceSchema = z
  .object({
    id,
    creditCardId: id,
    closingDate: isoDate,
    dueDate: isoDate,
    amount: money,
    paymentDate: nullable(isoDate),
  })
  .refine((i) => i.dueDate >= i.closingDate, {
    message: 'O vencimento não pode ser antes do fechamento.',
    path: ['dueDate'],
  });

// O cartão da fatura não muda depois de criada.
export const creditCardInvoicePatchSchema = z
  .object({
    closingDate: isoDate,
    dueDate: isoDate,
    amount: money,
    paymentDate: isoDate.nullable(),
  })
  .partial();

export const savingsGoalSchema = z.object({
  id,
  name: z.string().trim().min(1).max(80),
  targetAmount: positiveMoney,
  currentAmount: money,
  deadline: nullable(isoDate),
  institution: nullable(z.string().trim().min(1).max(60)),
  cdiPercent: nullable(z.number().finite().min(0).max(1000)),
  currency: z.enum(['BRL', 'USD']).default('BRL'),
  lockDays: nullable(z.number().int().min(1).max(3650)),
  depositDate: nullable(isoDate),
  monthlyContribution: nullable(money),
});

// Patches são escritos à mão, sem .default()/transform: em um .partial() eles preencheriam campos
// que não vieram (ex.: editar o nome voltaria a moeda para BRL ou o status para "active").
export const savingsGoalPatchSchema = z
  .object({
    name: z.string().trim().min(1).max(80),
    targetAmount: positiveMoney,
    deadline: isoDate.nullable(),
    institution: z.string().trim().min(1).max(60).nullable(),
    cdiPercent: z.number().finite().min(0).max(1000).nullable(),
    currency: z.enum(['BRL', 'USD']),
    lockDays: z.number().int().min(1).max(3650).nullable(),
    depositDate: isoDate.nullable(),
    monthlyContribution: money.nullable(),
  })
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
export const debtStatusSchema = z.enum(['active', 'awaiting_offer', 'negotiated', 'abandoned', 'paid']);

const debtFields = z.object({
  id,
  creditor: shortText,
  description: shortText,
  source: debtSourceSchema,
  currentAmount: money,
  overdueAmount: money,
  referenceDate: isoDate,
  status: debtStatusSchema.default('active'),
  notes: nullable(z.string().trim().max(500)),
});

export const debtSchema = debtFields.refine(
  (d) => d.currentAmount + d.overdueAmount > 0,
  'Dívida sem valor.',
);

/** Edição pela tela de Dívidas: origem e id não mudam. Sem defaults, pelo mesmo motivo do savingsGoalPatchSchema. */
export const debtPatchSchema = z
  .object({
    creditor: shortText,
    description: shortText,
    currentAmount: money,
    overdueAmount: money,
    referenceDate: isoDate,
    status: debtStatusSchema,
    notes: z.string().trim().max(500).nullable(),
  })
  .partial();

export const settingsPatchSchema = z
  .object({ dashboardDebtStatuses: z.array(debtStatusSchema).max(10) })
  .partial();

export const idSchema = id;
export const isoDateSchema = isoDate;
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
