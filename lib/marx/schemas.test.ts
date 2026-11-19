import { describe, expect, it } from 'vitest';

import { marxRequestSchema, MARX_MAX_HISTORY, parseMarxReply } from '@/lib/marx/schemas';

const refs = { cardIds: ['card-1'], accountIds: ['acc-1'], categories: ['Alimentação', 'Transporte', 'Outros'] };

const tx = (overrides: Record<string, unknown> = {}) => ({
  description: 'Mercado',
  amount: 32,
  type: 'expense',
  category: 'Alimentação',
  paymentMethod: 'debit',
  creditCardId: null,
  bankAccountId: null,
  date: '2026-10-30',
  isFixed: false,
  isPaid: true,
  ...overrides,
});

describe('marxRequestSchema', () => {
  it('guarda só as últimas mensagens do histórico', () => {
    const messages = Array.from({ length: MARX_MAX_HISTORY + 5 }, (_, i) => ({
      role: i % 2 === 0 ? 'user' : 'assistant',
      content: `msg ${i}`,
    }));
    const parsed = marxRequestSchema.parse({ messages });
    expect(parsed.messages).toHaveLength(MARX_MAX_HISTORY);
    expect(parsed.messages.at(-1)?.content).toBe(`msg ${MARX_MAX_HISTORY + 4}`);
  });

  it('recusa conversa que não termina com mensagem do usuário', () => {
    const result = marxRequestSchema.safeParse({ messages: [{ role: 'assistant', content: 'oi' }] });
    expect(result.success).toBe(false);
  });
});

describe('parseMarxReply', () => {
  it('aceita resposta sem lançamentos', () => {
    expect(parseMarxReply({ reply: 'Tudo certo!' }, refs)).toEqual({ reply: 'Tudo certo!', transactions: [], goalMoves: [] });
  });

  it('separa vários gastos e descarta só o item inválido', () => {
    const result = parseMarxReply(
      {
        reply: 'Anotei!',
        transactions: [tx(), tx({ amount: -5 }), tx({ description: 'Uber', category: 'transporte', paymentMethod: 'pix' })],
      },
      refs,
    );
    expect(result?.transactions.map((t) => t.description)).toEqual(['Mercado', 'Uber']);
    // Categoria casa sem maiúsculas/acentos e volta com a grafia da lista.
    expect(result?.transactions[1].category).toBe('Transporte');
  });

  it('não deixa passar ids de cartão ou conta que não são do usuário', () => {
    const result = parseMarxReply(
      {
        reply: 'ok',
        transactions: [
          tx({ paymentMethod: 'credit_card', creditCardId: 'card-de-outro' }),
          tx({ paymentMethod: 'credit_card', creditCardId: 'card-1', bankAccountId: 'acc-1' }),
          tx({ bankAccountId: 'acc-1' }),
          tx({ bankAccountId: 'acc-x' }),
        ],
      },
      refs,
    );
    expect(result?.transactions.map((t) => [t.creditCardId, t.bankAccountId])).toEqual([
      [null, null],
      ['card-1', null],
      [null, 'acc-1'],
      [null, null],
    ]);
  });

  it('categoria desconhecida vira "Outros"', () => {
    const result = parseMarxReply({ reply: 'ok', transactions: [tx({ category: 'Food' })] }, refs);
    expect(result?.transactions[0].category).toBe('Outros');
  });

  it('recusa resposta sem texto', () => {
    expect(parseMarxReply({ transactions: [] }, refs)).toBeNull();
    expect(parseMarxReply(null, refs)).toBeNull();
  });

  it('aceita guardar/tirar de caixinha só com id da lista, arredondando centavos', () => {
    const result = parseMarxReply(
      {
        reply: 'Tirei da caixinha.',
        goalMoves: [
          { goalId: 'veruska', action: 'withdraw', amount: 220.149 },
          { goalId: 'inventada', action: 'deposit', amount: 10 },
          { goalId: 'veruska', action: 'emprestar', amount: 10 },
        ],
      },
      { ...refs, goalIds: ['veruska'] },
    );
    expect(result?.goalMoves).toEqual([{ goalId: 'veruska', action: 'withdraw', amount: 220.15 }]);
  });
});
