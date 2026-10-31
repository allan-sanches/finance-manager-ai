import { describe, expect, it } from 'vitest';

import {
  cardLimit,
  cardUsage,
  invoiceOutflows,
  invoiceStatus,
  nextOpenInvoice,
  shortDate,
  summarizeMonth,
  todayISO,
} from '@/lib/finance';
import type { CreditCardInvoice, Transaction } from '@/types/finance';

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

describe('cardUsage', () => {
  const buy = (date: string, amount: number, o: Partial<Transaction> = {}): Transaction => ({
    id: date,
    description: 'compra',
    amount,
    type: 'expense',
    category: 'Outros',
    paymentMethod: 'credit_card',
    creditCardId: 'c1',
    date,
    isFixed: false,
    isPaid: true,
    ...o,
  });
  const invoice = (o: Partial<CreditCardInvoice>): CreditCardInvoice => ({
    id: 'i',
    creditCardId: 'c1',
    closingDate: '2026-10-05',
    dueDate: '2026-10-12',
    amount: 2000,
    paymentDate: null,
    ...o,
  });

  it('sem fatura: todas as compras no cartão ocupam o limite', () => {
    expect(cardUsage('c1', [buy('2026-09-01', 100), buy('2026-10-01', 50)], []).used).toBe(150);
  });

  it('fatura em aberto ocupa o limite mesmo sem compras lançadas', () => {
    expect(cardUsage('c1', [], [invoice({})])).toMatchObject({ openInvoices: 2000, unbilled: 0, used: 2000 });
  });

  it('compras antes do fechamento estão na fatura; a partir dele, na próxima', () => {
    const usage = cardUsage(
      'c1',
      [buy('2026-10-04', 300), buy('2026-10-05', 40), buy('2026-10-20', 60)],
      [invoice({})],
    );
    expect(usage).toMatchObject({ unbilled: 100, openInvoices: 2000, used: 2100 });
  });

  it('fatura paga libera o limite; débito e outro cartão não contam', () => {
    const usage = cardUsage(
      'c1',
      [buy('2026-10-20', 60), buy('2026-10-21', 70, { paymentMethod: 'debit', creditCardId: null }), buy('2026-10-22', 80, { creditCardId: 'c2' })],
      [invoice({ paymentDate: '2026-10-10' })],
    );
    expect(usage.used).toBe(60);
  });

  it('estorno abate das compras não faturadas', () => {
    expect(cardUsage('c1', [buy('2026-10-20', 100), buy('2026-10-21', 30, { type: 'income' })], []).unbilled).toBe(70);
  });
});

describe('saldo da conta', () => {
  const base: Transaction = {
    id: 't',
    description: 'x',
    amount: 100,
    type: 'expense',
    category: 'Outros',
    paymentMethod: 'debit',
    creditCardId: null,
    date: '2026-10-10',
    isFixed: false,
    isPaid: true,
  };

  it('trocar do débito para o crédito devolve o valor ao saldo do mês', () => {
    const income = { ...base, id: 'sal', type: 'income' as const, amount: 1000 };
    expect(summarizeMonth([income, base], '2026-10').balance).toBe(900);
    expect(summarizeMonth([income, { ...base, paymentMethod: 'credit_card', creditCardId: 'c1' }], '2026-10').balance).toBe(1000);
  });

  it('pagamento de fatura sai do saldo no mês em que foi pago', () => {
    const { realized, expected } = invoiceOutflows(
      [
        { dueDate: '2026-10-12', amount: 500, paymentDate: '2026-10-11' },
        { dueDate: '2026-11-12', amount: 700, paymentDate: null },
        { dueDate: '2026-09-12', amount: 900, paymentDate: null },
      ],
      '2026-10-20',
    );
    expect(realized).toEqual([{ date: '2026-10-11', amount: 500 }]);
    expect(expected).toEqual([{ date: '2026-11-12', amount: 700 }]);
    expect(summarizeMonth([], '2026-10', realized).expense).toBe(500);
  });
});
