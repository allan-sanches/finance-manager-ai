import { describe, expect, it } from 'vitest';

import { chatRequestSchema, parseExtraction } from '@/lib/chat-schemas';

const validRaw = {
  transaction: {
    description: 'Jantar no iFood',
    amount: 45,
    type: 'expense',
    category: 'Alimentação',
    paymentMethod: 'credit_card',
    creditCardId: 'card-1',
    date: '2026-10-28',
    isFixed: false,
  },
  confidence: 'high',
};

describe('parseExtraction', () => {
  it('aceita uma resposta válida e mantém cartão conhecido', () => {
    const result = parseExtraction(validRaw, ['card-1']);
    expect(result?.transaction.creditCardId).toBe('card-1');
    expect(result?.transaction.isPaid).toBe(false);
    expect(result?.confidence).toBe('high');
  });

  it('descarta creditCardId desconhecido', () => {
    expect(parseExtraction(validRaw, ['outro'])?.transaction.creditCardId).toBeNull();
  });

  it('descarta creditCardId quando o pagamento não é crédito', () => {
    const raw = { ...validRaw, transaction: { ...validRaw.transaction, paymentMethod: 'pix' } };
    expect(parseExtraction(raw, ['card-1'])?.transaction.creditCardId).toBeNull();
  });

  it('não repassa campos extras do modelo', () => {
    const raw = { ...validRaw, extra: 'x', transaction: { ...validRaw.transaction, hack: 1 } };
    const result = parseExtraction(raw, []);
    expect(result).not.toHaveProperty('extra');
    expect(result?.transaction).not.toHaveProperty('hack');
  });

  it.each([
    ['valor negativo', { amount: -10 }],
    ['data inválida', { date: '28/10/2026' }],
    ['tipo inválido', { type: 'transfer' }],
    ['descrição vazia', { description: '   ' }],
  ])('rejeita %s', (_label, patch) => {
    const raw = { ...validRaw, transaction: { ...validRaw.transaction, ...patch } };
    expect(parseExtraction(raw, [])).toBeNull();
  });

  it('rejeita lixo', () => {
    expect(parseExtraction(null, [])).toBeNull();
    expect(parseExtraction('texto', [])).toBeNull();
  });
});

describe('chatRequestSchema', () => {
  it('aplica trim e default de creditCards', () => {
    const result = chatRequestSchema.parse({ message: '  oi  ' });
    expect(result).toEqual({ message: 'oi', creditCards: [] });
  });

  it('rejeita mensagem vazia ou longa demais', () => {
    expect(chatRequestSchema.safeParse({ message: '   ' }).success).toBe(false);
    expect(chatRequestSchema.safeParse({ message: 'a'.repeat(1001) }).success).toBe(false);
  });

  it('rejeita message ausente com mensagem amigável', () => {
    const result = chatRequestSchema.safeParse({});
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe('Campo "message" obrigatório (string).');
  });
});
