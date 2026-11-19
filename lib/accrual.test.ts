import { describe, expect, it } from 'vitest';

import { accrue, accrueSnapshot, dailyCdiFactor } from '@/lib/accrual';
import { cardUsage } from '@/lib/finance';
import type { CreditCard, SavingsGoal } from '@/types/finance';

describe('rendimento por dia útil', () => {
  const factor = dailyCdiFactor(14.9, 100);

  it('100% do CDI a 14,9% a.a. rende ~0,0551% por dia útil', () => {
    // 1,149^(1/252) − 1 = 0,0005513…
    expect(factor).toBeCloseTo(1.000551, 6);
  });

  it('rende só em dia útil: sexta → segunda são 1 dia (a segunda)', () => {
    // 2026-11-13 é sexta; sábado e domingo não rendem.
    expect(accrue(1000, '2026-11-13', '2026-11-16', factor)).toBe(Math.round(1000 * factor * 100) / 100);
  });

  it('aplicação no meio do período passa a render a partir do dia seguinte', () => {
    const moves = new Map([['2026-11-17', 500]]);
    const expected = Math.round(((1000 * factor + 500) * factor) * 100) / 100; // 17 (ter) e 18 (qua)
    expect(accrue(1000, '2026-11-16', '2026-11-18', factor, moves)).toBe(expected);
  });
});

describe('accrueSnapshot', () => {
  const card: CreditCard = {
    id: 'inter',
    name: 'Inter',
    limit: 5571.71,
    closingDay: 28,
    dueDay: 5,
    currentInvoiceAmount: 0,
    securedLimit: true,
    limitDate: '2026-11-17',
    cdiPercent: 100,
  };
  const goal: SavingsGoal = {
    id: 'g',
    name: 'Reserva',
    targetAmount: 1000,
    currentAmount: 200,
    currency: 'BRL',
    cdiPercent: 100,
    amountDate: '2026-11-17',
  };

  it('leva CDB e caixinha até ontem e marca ontem como referência', () => {
    const out = accrueSnapshot({ creditCards: [card], savingsGoals: [goal], transactions: [] }, 14.9, '2026-11-20');
    const f = dailyCdiFactor(14.9, 100);
    expect(out.creditCards[0]).toMatchObject({ limit: Math.round(5571.71 * f * f * 100) / 100, limitDate: '2026-11-19' });
    expect(out.savingsGoals[0]).toMatchObject({ currentAmount: Math.round(200 * f * f * 100) / 100, amountDate: '2026-11-19' });
  });

  it('sem CDI, nada muda', () => {
    const input = { creditCards: [card], savingsGoals: [goal], transactions: [] };
    expect(accrueSnapshot(input, null, '2026-11-20')).toBe(input);
  });
});

describe('cardUsage com o limite usado do banco', () => {
  const buy = (date: string, amount: number) => ({
    paymentMethod: 'credit_card' as const,
    creditCardId: 'inter',
    date,
    amount,
    type: 'expense' as const,
  });
  const invoice = (paymentDate: string | null, amount: number) => ({
    creditCardId: 'inter',
    closingDate: '2026-11-28',
    amount,
    paymentDate,
  });
  const bank = { usedAmount: 5550.37, usedDate: '2026-11-17' };

  it('parte do valor do banco, soma compras depois e desconta faturas pagas depois', () => {
    const usage = cardUsage(
      'inter',
      [buy('2026-11-10', 999), buy('2026-11-18', 50)],
      [invoice('2026-12-05', 1698.92), invoice(null, 1872.8)],
      '2026-12-06',
      bank,
    );
    expect(usage.used).toBe(Math.round((5550.37 + 50 - 1698.92) * 100) / 100);
    expect(usage.unbilled).toBe(50);
  });
});
