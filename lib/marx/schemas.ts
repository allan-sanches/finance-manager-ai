import { z } from 'zod';

import { normalizeCategoryName } from '@/lib/tones';
import type { TransactionDraft } from '@/types/finance';

// Contrato do assistente Marx, compartilhado pela rota (validação) e pelo chat (tipos).

export const MARX_MAX_MESSAGE_LENGTH = 2000;
/** Só as últimas mensagens vão para a IA: conversa longa fica cara e lenta. */
export const MARX_MAX_HISTORY = 20;
const MAX_PROPOSALS = 30;

export const marxMessageSchema = z.object({
  role: z.enum(['user', 'assistant']),
  content: z.string().trim().min(1).max(4000),
});

export type MarxMessage = z.infer<typeof marxMessageSchema>;

export const marxRequestSchema = z.object({
  messages: z
    .array(marxMessageSchema)
    .min(1, 'Conversa vazia.')
    .transform((list) => list.slice(-MARX_MAX_HISTORY))
    .refine((list) => list.at(-1)?.role === 'user', 'A última mensagem precisa ser sua.')
    .refine(
      (list) => (list.at(-1)?.content.length ?? 0) <= MARX_MAX_MESSAGE_LENGTH,
      `Mensagem muito longa (máximo ${MARX_MAX_MESSAGE_LENGTH} caracteres).`,
    ),
});

export type MarxReply = {
  reply: string;
  /** Lançamentos que o Marx entendeu da mensagem; só entram depois que o usuário confirma. */
  transactions: TransactionDraft[];
};

const proposalSchema = z.object({
  description: z.string().trim().min(1).max(200),
  amount: z.coerce.number().finite().positive().max(10_000_000),
  type: z.enum(['income', 'expense']),
  category: z.string().trim().min(1).max(100),
  paymentMethod: z.enum(['cash', 'debit', 'credit_card', 'pix', 'bank_transfer']),
  creditCardId: z.string().nullish(),
  bankAccountId: z.string().nullish(),
  date: z.iso.date(),
  isFixed: z.boolean().optional(),
  isPaid: z.boolean().optional(),
});

const replySchema = z.object({
  reply: z.string().trim().min(1).max(8000),
  // Uma proposta inválida não derruba a resposta: é descartada e as outras seguem.
  transactions: z.array(z.unknown()).max(MAX_PROPOSALS).optional(),
});

export type MarxRefs = {
  cardIds: ReadonlyArray<string>;
  accountIds: ReadonlyArray<string>;
  categories: ReadonlyArray<string>;
};

/**
 * Valida a resposta bruta e monta DTOs novos campo a campo. IDs de cartão/conta só sobrevivem se
 * forem do usuário; categoria fora da lista vira "Outros" (copiando a grafia exata da lista).
 */
export function parseMarxReply(raw: unknown, refs: MarxRefs): MarxReply | null {
  const result = replySchema.safeParse(raw);
  if (!result.success) return null;

  const categoryByKey = new Map(refs.categories.map((c) => [normalizeCategoryName(c), c]));
  const transactions: TransactionDraft[] = [];
  for (const item of result.data.transactions ?? []) {
    const parsed = proposalSchema.safeParse(item);
    if (!parsed.success) continue;
    const tx = parsed.data;
    const creditCardId =
      tx.paymentMethod === 'credit_card' && tx.creditCardId && refs.cardIds.includes(tx.creditCardId)
        ? tx.creditCardId
        : null;
    const bankAccountId =
      tx.paymentMethod !== 'credit_card' && tx.bankAccountId && refs.accountIds.includes(tx.bankAccountId)
        ? tx.bankAccountId
        : null;
    transactions.push({
      description: tx.description,
      amount: Math.round(tx.amount * 100) / 100,
      type: tx.type,
      category: categoryByKey.get(normalizeCategoryName(tx.category)) ?? 'Outros',
      paymentMethod: tx.paymentMethod,
      creditCardId,
      bankAccountId,
      date: tx.date,
      isFixed: tx.isFixed ?? false,
      isPaid: tx.isPaid ?? true,
    });
  }

  return { reply: result.data.reply, transactions };
}
