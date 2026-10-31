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
  bankAccountId: id.nullish().transform((v) => v ?? null),
  // Sem .default(): no patch (.partial()) ele preencheria false em toda edição.
  isTransfer: z.boolean().optional(),
  savingsGoalId: id.nullish().transform((v) => v ?? null),
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
  securedLimit: z.boolean().optional(),
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

// Saldo pode ficar negativo (cheque especial).
export const bankAccountSchema = z.object({
  id,
  name: z.string().trim().min(1).max(60),
  balance: z.number().finite().min(-1_000_000_000_000).max(1_000_000_000_000),
  balanceDate: isoDate,
});

export const bankAccountPatchSchema = bankAccountSchema.omit({ id: true }).partial();

const timeDeposits = z
  .array(z.object({ id, amount: positiveMoney, maturityDate: isoDate }))
  .max(50);

export const savingsGoalSchema = z.object({
  id,
  name: z.string().trim().min(1).max(80),
  targetAmount: positiveMoney,
  currentAmount: money,
  deadline: nullable(isoDate),
  institution: nullable(z.string().trim().min(1).max(60)),
  cdiPercent: nullable(z.number().finite().min(0).max(1000)),
  annualRate: nullable(z.number().finite().min(0).max(100)),
  currency: z.enum(['BRL', 'USD']).default('BRL'),
  lockDays: nullable(z.number().int().min(1).max(3650)),
  depositDate: nullable(isoDate),
  monthlyContribution: nullable(money),
  timeDeposits: timeDeposits.default([]),
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
    annualRate: z.number().finite().min(0).max(100).nullable(),
    currency: z.enum(['BRL', 'USD']),
    lockDays: z.number().int().min(1).max(3650).nullable(),
    depositDate: isoDate.nullable(),
    monthlyContribution: money.nullable(),
    timeDeposits,
  })
  .partial();

// Foto do desejo: miniatura gerada no aparelho (data URL, ~30 KB) ou link https de uma imagem.
// Nada de outros esquemas: o valor vai direto para o src de um <img>.
const MAX_IMAGE_CHARS = 300_000;
const imageUrl = z.union([
  z.string().max(MAX_IMAGE_CHARS).regex(/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/),
  z.url({ protocol: /^https$/ }).max(2000),
]);
// Link da loja vai num <a href>: só http(s), nunca javascript:.
const productUrl = z.url({ protocol: /^https?$/ }).max(2000);
const priceHistory = z.array(z.object({ date: isoDate, price: money })).max(500);

export const shoppingItemSchema = z.object({
  id,
  name: shortText,
  listType: z.enum(['household', 'wishlist']),
  estimatedPrice: money.nullish().transform((v) => v ?? null),
  priority: z.enum(['low', 'medium', 'high']).optional(),
  isPurchased: z.boolean(),
  imageUrl: imageUrl.nullish().transform((v) => v ?? null),
  productUrl: productUrl.nullish().transform((v) => v ?? null),
  priceHistory: priceHistory.optional(),
});

export const shoppingItemPatchSchema = z
  .object({
    name: shortText,
    listType: z.enum(['household', 'wishlist']),
    estimatedPrice: money.nullable(),
    priority: z.enum(['low', 'medium', 'high']),
    isPurchased: z.boolean(),
    imageUrl: imageUrl.nullable(),
    productUrl: productUrl.nullable(),
    priceHistory,
  })
  .partial();

export const categorySchema = z.object({
  id,
  name: z.string().trim().min(1).max(40),
  // Um emoji pode ter vários code points (pele, ZWJ, bandeiras): limita por tamanho, não por 1 caractere.
  emoji: z.string().trim().min(1).max(16),
  tone: z.enum(TONES),
});

export const debtSourceSchema = z.enum(['scr', 'serasa', 'manual']);
// Situações são do usuário (settings.debtStatuses): o id é livre, só o formato é validado.
export const debtStatusSchema = z.string().trim().min(1).max(60);

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

const debtStatusOptionSchema = z.object({
  id: debtStatusSchema,
  label: z.string().trim().min(1).max(40),
  tone: z.enum(TONES),
});

export const settingsPatchSchema = z
  .object({
    dashboardDebtStatuses: z.array(debtStatusSchema).max(30),
    debtStatuses: z
      .array(debtStatusOptionSchema)
      .min(1)
      .max(30)
      .refine((list) => new Set(list.map((s) => s.id)).size === list.length, 'Situação repetida.')
      .refine((list) => list.some((s) => s.id === 'active'), 'A situação padrão não pode ser apagada.'),
    hiddenCategories: z.array(z.string().trim().min(1).max(80)).max(100),
    displayName: z.string().trim().max(40),
  })
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
