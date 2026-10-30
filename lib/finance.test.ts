import { describe, expect, it } from 'vitest';

import { cardLimit, todayISO } from '@/lib/finance';

describe('todayISO', () => {
  it('usa o fuso de Brasília, não UTC', () => {
    // 01:30 UTC do dia 30 = 22:30 do dia 29 em Brasília
    expect(todayISO(new Date('2026-10-30T01:30:00Z'))).toBe('2026-10-29');
  });

  it('retorna o mesmo dia no meio do dia', () => {
    expect(todayISO(new Date('2026-10-29T15:00:00Z'))).toBe('2026-10-29');
  });
});

describe('cardLimit', () => {
  const inter = { id: 'g-inter', currency: 'BRL' as const, currentAmount: 3200 };

  it('usa o saldo da caixinha que garante o limite', () => {
    expect(cardLimit({ limit: 1000, limitSavingsGoalId: 'g-inter' }, [inter])).toBe(3200);
  });

  it('usa o limite fixo sem caixinha vinculada', () => {
    expect(cardLimit({ limit: 1000, limitSavingsGoalId: null }, [inter])).toBe(1000);
  });

  it('volta para o limite fixo se a caixinha sumiu ou é em dólar', () => {
    expect(cardLimit({ limit: 1000, limitSavingsGoalId: 'apagada' }, [inter])).toBe(1000);
    expect(
      cardLimit({ limit: 1000, limitSavingsGoalId: 'g-usd' }, [
        { id: 'g-usd', currency: 'USD', currentAmount: 50 },
      ]),
    ).toBe(1000);
  });
});
