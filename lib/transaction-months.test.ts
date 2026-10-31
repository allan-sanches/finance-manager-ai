import { describe, expect, it } from 'vitest';

import {
  groupByMonth,
  isDebtPayment,
  isMonthKey,
  monthTitle,
  shiftMonth,
  splitByTiming,
  totalsOf,
} from '@/lib/transaction-months';
import type { Transaction } from '@/types/finance';

let seq = 0;
function tx(partial: Partial<Transaction>): Transaction {
  seq += 1;
  return {
    id: `t${seq}`,
    description: 'x',
    amount: 100,
    type: 'expense',
    category: 'Alimentação',
    paymentMethod: 'pix',
    date: '2026-10-10',
    isFixed: false,
    isPaid: true,
    ...partial,
  };
}

describe('splitByTiming', () => {
  it('data depois de hoje é previsto, hoje ou antes é realizado', () => {
    const past = tx({ date: '2026-10-28' });
    const today = tx({ date: '2026-10-29' });
    const future = tx({ date: '2026-10-30' });
    const { realized, expected } = splitByTiming([past, today, future], '2026-10-29');
    expect(realized).toEqual([past, today]);
    expect(expected).toEqual([future]);
  });
});

describe('totalsOf', () => {
  it('separa receitas, despesas e dívidas e calcula o saldo', () => {
    const totals = totalsOf('2026-10', [
      tx({ type: 'income', amount: 5000, category: 'Salário' }),
      tx({ amount: 300 }),
      tx({ amount: 700, category: 'Dívidas', isPaid: false }),
    ]);
    expect(totals).toMatchObject({ income: 5000, expense: 300, debt: 700, balance: 4000, count: 3, openCount: 1 });
  });

  it('receita na categoria Dívidas continua sendo receita', () => {
    const income = tx({ type: 'income', category: 'Dívidas' });
    expect(isDebtPayment(income)).toBe(false);
    expect(totalsOf('2026-10', [income]).income).toBe(100);
  });
});

describe('totalsOf com cartão', () => {
  it('compra no crédito não sai do saldo; a fatura paga sai', () => {
    const totals = totalsOf(
      '2026-10',
      [
        tx({ type: 'income', amount: 5000, category: 'Salário' }),
        tx({ amount: 300, paymentMethod: 'debit' }),
        tx({ amount: 450, paymentMethod: 'credit_card', creditCardId: 'c1' }),
      ],
      [{ date: '2026-10-12', amount: 1200 }],
    );
    expect(totals).toMatchObject({ expense: 300, card: 450, invoices: 1200, balance: 3500, count: 3 });
  });
});

describe('groupByMonth', () => {
  it('cria o mês só com pagamento de fatura', () => {
    const months = groupByMonth([tx({ date: '2026-10-05' })], 'desc', [{ date: '2026-11-10', amount: 80 }]);
    expect(months.map((m) => [m.key, m.invoices])).toEqual([
      ['2026-11', 80],
      ['2026-10', 0],
    ]);
  });


  const rows = [tx({ date: '2026-08-01' }), tx({ date: '2026-10-05' }), tx({ date: '2026-10-20' })];

  it('ordena do mais recente para o mais antigo por padrão', () => {
    expect(groupByMonth(rows).map((m) => [m.key, m.count])).toEqual([
      ['2026-10', 2],
      ['2026-08', 1],
    ]);
  });

  it('ordena crescente para o previsto', () => {
    expect(groupByMonth(rows, 'asc').map((m) => m.key)).toEqual(['2026-08', '2026-10']);
  });
});

describe('helpers de mês', () => {
  it('shiftMonth atravessa a virada do ano', () => {
    expect(shiftMonth('2026-12', 1)).toBe('2027-01');
    expect(shiftMonth('2026-01', -1)).toBe('2025-12');
  });

  it('isMonthKey valida YYYY-MM', () => {
    expect(isMonthKey('2026-10')).toBe(true);
    expect(isMonthKey('2026-13')).toBe(false);
    expect(isMonthKey('outubro')).toBe(false);
  });

  it('monthTitle escreve o mês por extenso', () => {
    expect(monthTitle('2026-10')).toBe('Outubro de 2026');
  });
});
