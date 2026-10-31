import { describe, expect, it } from 'vitest';

import { searchFinance, type SearchSources } from '@/lib/search';
import type { Transaction } from '@/types/finance';

const tx = (overrides: Partial<Transaction>): Transaction => ({
  id: overrides.id ?? 't',
  description: 'Mercado',
  amount: 100,
  type: 'expense',
  category: 'Alimentação',
  paymentMethod: 'pix',
  date: '2026-10-01',
  isFixed: false,
  isPaid: true,
  ...overrides,
});

const sources = (over: Partial<SearchSources> = {}): SearchSources => ({
  transactions: [],
  bankAccounts: [],
  creditCards: [],
  savingsGoals: [],
  ...over,
});

describe('searchFinance', () => {
  it('acha pessoa na descrição sem ligar para acento e maiúscula, mais recente primeiro', () => {
    const result = searchFinance(
      'joao',
      sources({
        transactions: [
          tx({ id: 'a', description: 'Pix João Silva', date: '2026-09-01', amount: 50 }),
          tx({ id: 'b', description: 'PIX JOÃO SILVA', date: '2026-10-05', type: 'income', amount: 20 }),
          tx({ id: 'c', description: 'Padaria' }),
        ],
      }),
    );
    expect(result.transactions.map((t) => t.id)).toEqual(['b', 'a']);
    expect(result.totals).toEqual({ income: 20, expense: 50 });
  });

  it('todas as palavras precisam aparecer, em qualquer ordem', () => {
    const transactions = [tx({ id: 'a', description: 'Uber viagem centro' }), tx({ id: 'b', description: 'Uber Eats' })];
    expect(searchFinance('centro uber', sources({ transactions })).transactions.map((t) => t.id)).toEqual(['a']);
  });

  it('acha pela categoria e resume a categoria', () => {
    const transactions = [
      tx({ id: 'a', category: 'Saúde', amount: 80 }),
      tx({ id: 'b', category: 'saude', amount: 20 }),
      tx({ id: 'c', category: 'Lazer' }),
    ];
    const result = searchFinance('saude', sources({ transactions }));
    expect(result.categories).toEqual([{ name: 'Saúde', count: 2, expense: 100, income: 0 }]);
    expect(result.transactions).toHaveLength(2);
  });

  it('acha pelo banco, cartão e caixinha da transação', () => {
    const transactions = [
      tx({ id: 'a', bankAccountId: 'bk' }),
      tx({ id: 'b', creditCardId: 'cc', paymentMethod: 'credit_card' }),
      tx({ id: 'c', savingsGoalId: 'g', isTransfer: true }),
    ];
    const s = sources({
      transactions,
      bankAccounts: [{ id: 'bk', name: 'Inter' }],
      creditCards: [{ id: 'cc', name: 'Nubank' }],
      savingsGoals: [{ id: 'g', name: 'Viagem' }],
    });
    expect(searchFinance('inter', s).transactions.map((t) => t.id)).toEqual(['a']);
    expect(searchFinance('nubank', s).transactions.map((t) => t.id)).toEqual(['b']);
    const goal = searchFinance('viagem', s);
    expect(goal.transactions.map((t) => t.id)).toEqual(['c']);
    expect(goal.totals).toEqual({ income: 0, expense: 0 }); // movimentação não é gasto
  });

  it('acha pelo valor: inteiro casa os reais, com centavos casa exato', () => {
    const transactions = [tx({ id: 'a', amount: 45.9 }), tx({ id: 'b', amount: 45 }), tx({ id: 'c', amount: 145 })];
    expect(searchFinance('45', sources({ transactions })).transactions.map((t) => t.id).sort()).toEqual(['a', 'b']);
    expect(searchFinance('45,90', sources({ transactions })).transactions.map((t) => t.id)).toEqual(['a']);
  });

  it('acha a categoria Pessoas e quem está nela pelo nome', () => {
    const transactions = [
      tx({ id: 'a', category: 'Pessoas', description: 'Pix Maria' }),
      tx({ id: 'b', category: 'Pessoas', description: 'Pix Carlos' }),
      tx({ id: 'c', description: 'Mercado' }),
    ];
    const byCategory = searchFinance('pessoas', sources({ transactions }));
    expect(byCategory.categories.map((c) => c.name)).toEqual(['Pessoas']);
    expect(byCategory.transactions.map((t) => t.id).sort()).toEqual(['a', 'b']);
    expect(searchFinance('maria', sources({ transactions })).transactions.map((t) => t.id)).toEqual(['a']);
  });

  it('busca curta demais não traz nada', () => {
    expect(searchFinance('a', sources({ transactions: [tx({ description: 'abc' })] })).transactions).toEqual([]);
  });
});
