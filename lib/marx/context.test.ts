import { describe, expect, it } from 'vitest';

import { DEFAULT_SETTINGS } from '@/lib/finance';
import { buildFinanceContext } from '@/lib/marx/context';
import type { MarketQuotes } from '@/lib/marx/quotes';
import type { FinanceSnapshot, Transaction } from '@/types/finance';

const tx = (overrides: Partial<Transaction>): Transaction => ({
  id: Math.random().toString(36),
  description: 'Mercado',
  amount: 100,
  type: 'expense',
  category: 'Alimentação',
  paymentMethod: 'debit',
  date: '2026-10-20',
  isFixed: false,
  isPaid: true,
  ...overrides,
});

const snapshot = (overrides: Partial<FinanceSnapshot> = {}): FinanceSnapshot => ({
  transactions: [],
  creditCards: [],
  creditCardInvoices: [],
  bankAccounts: [],
  savingsGoals: [],
  shoppingItems: [],
  debts: [],
  categories: [],
  settings: DEFAULT_SETTINGS,
  ...overrides,
});

const quotes: MarketQuotes = {
  currencies: [{ name: 'Dólar Americano/Real Brasileiro', brl: 5.5, changePercent: -0.3, updatedAt: '2026-10-31 10:00:00' }],
  cdiAnnual: { rate: 14.9, date: '30/10/2026' },
  selicTarget: { rate: 15, date: '30/10/2026' },
};

const TODAY = '2026-10-31';

describe('buildFinanceContext', () => {
  it('traz o mês, os lançamentos e as cotações', () => {
    const text = buildFinanceContext(
      snapshot({ transactions: [tx({ description: 'Feira', amount: 80 }), tx({ type: 'income', description: 'Salário', amount: 5000, category: 'Salário' })] }),
      quotes,
      TODAY,
    );
    expect(text).toContain('Outubro de 2026 (mês atual');
    expect(text).toMatch(/entradas R\$\s5\.000,00, saídas R\$\s80,00/);
    expect(text).toContain('Feira');
    expect(text).toMatch(/Dólar Americano\/Real Brasileiro: R\$\s5,50/);
    expect(text).toContain('Meta Selic: 15% a.a.');
  });

  it('esconde as categorias ocultas, como o dashboard', () => {
    const text = buildFinanceContext(
      snapshot({
        transactions: [tx({ description: 'Presente secreto', category: 'Segredo' })],
        settings: { ...DEFAULT_SETTINGS, hiddenCategories: ['segredo'] },
      }),
      quotes,
      TODAY,
    );
    expect(text).not.toContain('Presente secreto');
  });

  it('lista desejos pendentes e marca contas atrasadas', () => {
    const text = buildFinanceContext(
      snapshot({
        transactions: [tx({ description: 'Internet', isPaid: false, date: '2026-10-10' })],
        shoppingItems: [
          { id: 'w1', name: 'Fone bluetooth', listType: 'wishlist', estimatedPrice: 300, priority: 'high', isPurchased: false },
          { id: 'w2', name: 'Já comprado', listType: 'wishlist', isPurchased: true },
        ],
      }),
      quotes,
      TODAY,
    );
    expect(text).toContain('2026-10-10 (ATRASADA) | Internet');
    expect(text).toContain('Fone bluetooth');
    expect(text).not.toContain('Já comprado');
  });

  it('avisa quando as cotações estão fora do ar', () => {
    const text = buildFinanceContext(snapshot(), { currencies: [], cdiAnnual: null, selicTarget: null }, TODAY);
    expect(text).toContain('Cotações indisponíveis no momento.');
  });
});
