import { describe, expect, it } from 'vitest';

import { addMonths, installmentLabel, remainingInstallments, splitPurchase, upcomingInvoices } from '@/lib/installments';
import type { TransactionDraft } from '@/types/finance';

const draft: TransactionDraft = {
  description: 'C&A',
  amount: 239.97,
  type: 'expense',
  category: 'Compras',
  paymentMethod: 'credit_card',
  creditCardId: 'inter',
  date: '2026-11-02',
  isFixed: false,
  isPaid: true,
};

describe('addMonths', () => {
  it('mantém o dia e cai no último dia quando o mês é menor', () => {
    expect(addMonths('2026-11-02', 1)).toBe('2026-12-02');
    expect(addMonths('2026-11-02', 2)).toBe('2027-01-02');
    expect(addMonths('2027-01-31', 1)).toBe('2027-02-28');
  });
});

describe('splitPurchase', () => {
  it('total em 3x: uma parcela por mês, centavos que sobram na primeira', () => {
    const parts = splitPurchase({ ...draft, amount: 100 }, 3, 'total');
    expect(parts.map((p) => [p.description, p.amount, p.date, p.isPaid])).toEqual([
      ['C&A (1/3)', 33.34, '2026-11-02', true],
      ['C&A (2/3)', 33.33, '2026-12-02', false],
      ['C&A (3/3)', 33.33, '2027-01-02', false],
    ]);
    expect(new Set(parts.map((p) => p.installmentGroupId)).size).toBe(1);
  });

  it('valor de cada parcela: repete o valor', () => {
    expect(splitPurchase({ ...draft, amount: 79.99 }, 3, 'installment').map((p) => p.amount)).toEqual([79.99, 79.99, 79.99]);
  });
});

describe('remainingInstallments', () => {
  it('parcela 2 de 4 numa fatura que fecha em 28/11: a 3ª e a 4ª nas véspera dos próximos fechamentos', () => {
    const rest = remainingInstallments({ ...draft, description: 'PIX CRED PARCELADO 02/04', amount: 56.39 }, 2, 4, '2026-11-28');
    expect(rest.map((p) => [p.description, p.date])).toEqual([
      ['PIX CRED PARCELADO (3/4)', '2026-12-27'],
      ['PIX CRED PARCELADO (4/4)', '2027-01-27'],
    ]);
  });
});

describe('installmentLabel', () => {
  it('troca o "02/04" do banco pelo número da parcela', () => {
    expect(installmentLabel('LOJA X 02/04', 3, 4)).toBe('LOJA X (3/4)');
  });
});

describe('upcomingInvoices', () => {
  const card = { id: 'inter', closingDay: 28, dueDay: 5 };
  const buy = (date: string, amount: number, createdAt = '2026-11-17T12:00:00Z') => ({
    paymentMethod: 'credit_card' as const,
    creditCardId: 'inter',
    date,
    amount,
    type: 'expense' as const,
    createdAt,
  });

  it('soma as parcelas de cada ciclo; fatura informada vale o valor do banco', () => {
    const invoices = [
      { creditCardId: 'inter', closingDate: '2026-11-28', dueDate: '2026-12-05', amount: 1698.92, paymentDate: null, recordedAt: '2026-11-17T13:00:00Z' },
    ];
    const txs = [buy('2026-11-10', 50), buy('2026-12-27', 56.39), buy('2026-12-20', 28.19), buy('2027-01-27', 56.39)];
    expect(upcomingInvoices(card, txs, invoices, '2026-11-17', 3)).toEqual([
      { closingDate: '2026-11-28', dueDate: '2026-12-05', amount: 1698.92, source: 'informed' },
      { closingDate: '2026-12-28', dueDate: '2027-01-05', amount: 84.58, source: 'projected' },
      { closingDate: '2027-01-28', dueDate: '2027-02-05', amount: 56.39, source: 'projected' },
    ]);
  });
});
