import { z } from 'zod';

import type { ChatExtraction } from '@/types/finance';

export const MAX_MESSAGE_LENGTH = 1000;
const MAX_CREDIT_CARDS = 50;

export const creditCardRefSchema = z.object({
  id: z.string().trim().min(1).max(100),
  name: z.string().trim().min(1).max(100),
});

export type CreditCardRef = z.infer<typeof creditCardRefSchema>;

export const chatRequestSchema = z.object({
  message: z
    .string({ error: 'Campo "message" obrigatório (string).' })
    .trim()
    .min(1, 'Mensagem vazia.')
    .max(MAX_MESSAGE_LENGTH, `Mensagem muito longa (máximo ${MAX_MESSAGE_LENGTH} caracteres).`),
  creditCards: z
    .array(creditCardRefSchema)
    .max(MAX_CREDIT_CARDS, `No máximo ${MAX_CREDIT_CARDS} cartões por requisição.`)
    .default([]),
});

export type ChatRequest = z.infer<typeof chatRequestSchema>;

const extractionSchema = z.object({
  transaction: z.object({
    description: z.string().trim().min(1),
    amount: z.coerce.number().finite().positive(),
    type: z.enum(['income', 'expense']),
    category: z.string().trim().min(1),
    paymentMethod: z.enum(['cash', 'debit', 'credit_card', 'pix', 'bank_transfer']),
    creditCardId: z.string().nullish(),
    date: z.iso.date(),
    isFixed: z.boolean(),
    isPaid: z.boolean().optional(),
  }),
  confidence: z.enum(['low', 'medium', 'high']),
  notes: z.string().trim().optional(),
});

/**
 * Valida a resposta bruta do modelo e monta um DTO novo campo a campo.
 * creditCardId só sobrevive se o pagamento for crédito e o ID estiver entre os cartões enviados.
 */
export function parseExtraction(
  raw: unknown,
  knownCardIds: ReadonlyArray<string>,
): ChatExtraction | null {
  const result = extractionSchema.safeParse(raw);
  if (!result.success) return null;

  const { transaction: tx, confidence, notes } = result.data;
  const creditCardId =
    tx.paymentMethod === 'credit_card' && tx.creditCardId && knownCardIds.includes(tx.creditCardId)
      ? tx.creditCardId
      : null;

  return {
    transaction: {
      description: tx.description,
      amount: tx.amount,
      type: tx.type,
      category: tx.category,
      paymentMethod: tx.paymentMethod,
      creditCardId,
      date: tx.date,
      isFixed: tx.isFixed,
      isPaid: tx.isPaid ?? false,
    },
    confidence,
    notes: notes || undefined,
  };
}
