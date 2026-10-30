import { describe, expect, it } from 'vitest';

import { cardLimit, invoiceStatus, nextOpenInvoice, shortDate, todayISO } from '@/lib/finance';
import type { CreditCardInvoice } from '@/types/finance';

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

describe('faturas', () => {
  const inv = (o: Partial<CreditCardInvoice>): CreditCardInvoice => ({
    id: 'i',
    creditCardId: 'c1',
    closingDate: '2026-11-05',
    dueDate: '2026-11-12',
    amount: 100,
    paymentDate: null,
    ...o,
  });

  it('classifica paga, em aberto e vencida', () => {
    expect(invoiceStatus(inv({ paymentDate: '2026-11-10' }), '2026-12-01')).toBe('paid');
    expect(invoiceStatus(inv({}), '2026-11-12')).toBe('open');
    expect(invoiceStatus(inv({}), '2026-11-13')).toBe('overdue');
  });

  it('próxima fatura é a em aberto que vence primeiro, só do cartão pedido', () => {
    const list = [
      inv({ id: 'paga', dueDate: '2026-10-12', paymentDate: '2026-10-11' }),
      inv({ id: 'dez', dueDate: '2026-12-12' }),
      inv({ id: 'nov', dueDate: '2026-11-12' }),
      inv({ id: 'outro', creditCardId: 'c2', dueDate: '2026-09-12' }),
    ];
    expect(nextOpenInvoice(list, 'c1')?.id).toBe('nov');
    expect(nextOpenInvoice(list, 'c3')).toBeUndefined();
  });

  it('formata data curta sem cair no dia anterior', () => {
    expect(shortDate('2026-11-01')).toBe('01/11');
  });
});
