import { describe, expect, it } from 'vitest';

import {
  accountBalance,
  addDays,
  cardLimit,
  cardUsage,
  invoiceOutflows,
  invoiceStatus,
  nextOpenInvoice,
  securedCardIds,
  securedCardSavings,
  shortDate,
  summarizeMonth,
  todayISO,
  withoutHiddenCategories,
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

  describe('limite garantido por investimento (CDB)', () => {
    const card = { id: 'inter', limit: 5120.24, limitSavingsGoalId: null, securedLimit: true, limitDate: '2026-10-31' };
    const move = (date: string, type: 'income' | 'expense', amount: number, extra = {}) => ({
      date,
      type,
      amount,
      creditCardId: 'inter',
      isTransfer: true,
      paymentMethod: 'bank_transfer' as const,
      ...extra,
    });

    it('aplicação depois da data conferida aumenta, resgate diminui', () => {
      const txs = [move('2026-11-02', 'expense', 270), move('2026-11-03', 'expense', 150), move('2026-11-05', 'income', 100)];
      expect(cardLimit(card, [], txs)).toBe(5440.24);
    });

    it('ignora o que é até a data conferida, de outro cartão, compra no cartão ou não é movimentação', () => {
      const txs = [
        move('2026-10-31', 'expense', 1000),
        move('2026-11-02', 'expense', 50, { creditCardId: 'outro' }),
        move('2026-11-02', 'expense', 60, { paymentMethod: 'credit_card' }),
        move('2026-11-02', 'expense', 70, { isTransfer: false }),
      ];
      expect(cardLimit(card, [], txs)).toBe(5120.24);
    });

    it('sem data conferida fica o valor cadastrado', () => {
      expect(cardLimit({ ...card, limitDate: null }, [], [move('2026-11-02', 'expense', 270)])).toBe(5120.24);
    });
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

  it('faturas futuras de parcelas ocupam o limite, mas o corte das compras novas é a fatura atual', () => {
    const usage = cardUsage(
      'c1',
      [buy('2026-10-20', 999), buy('2026-11-30', 50)],
      [
        invoice({ id: 'dez', closingDate: '2026-11-28', amount: 396.78 }),
        invoice({ id: 'jan', closingDate: '2026-12-29', amount: 1224.62 }),
        invoice({ id: 'mar', closingDate: '2027-02-26', amount: 250.4 }),
      ],
      '2026-10-31',
    );
    // A compra de 20/10 está na fatura de dezembro; a de 30/11 já é da seguinte e conta à parte.
    expect(usage).toMatchObject({ unbilled: 50, openInvoices: 1871.8, lastClosingDate: '2026-11-28' });
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
        { creditCardId: 'c1', dueDate: '2026-10-12', amount: 500, paymentDate: '2026-10-11' },
        { creditCardId: 'c1', dueDate: '2026-11-12', amount: 700, paymentDate: null },
        { creditCardId: 'c1', dueDate: '2026-09-12', amount: 900, paymentDate: null },
      ],
      '2026-10-20',
    );
    expect(realized).toEqual([{ date: '2026-10-11', amount: 500 }]);
    expect(expected).toEqual([{ date: '2026-11-12', amount: 700 }]);
    expect(summarizeMonth([], '2026-10', realized).expense).toBe(500);
  });

  it('cartão de limite garantido: a compra conta no dia e a fatura dele não pesa de novo', () => {
    const secured = securedCardIds([
      { id: 'inter', securedLimit: true },
      { id: 'mp', securedLimit: false },
    ]);
    const onInter = { ...base, id: 'i', amount: 200, paymentMethod: 'credit_card' as const, creditCardId: 'inter' };
    const onMp = { ...base, id: 'm', amount: 70, paymentMethod: 'credit_card' as const, creditCardId: 'mp' };
    const { realized } = invoiceOutflows(
      [
        { creditCardId: 'inter', dueDate: '2026-10-10', amount: 200, paymentDate: '2026-10-09' },
        { creditCardId: 'mp', dueDate: '2026-10-04', amount: 70, paymentDate: '2026-10-03' },
      ],
      '2026-10-20',
      secured,
    );
    expect(realized).toEqual([{ date: '2026-10-03', amount: 70 }]);
    // Inter: a compra (200) no dia; MP: a fatura paga (70). Nada contado duas vezes.
    expect(summarizeMonth([onInter, onMp], '2026-10', realized, secured).expense).toBe(270);
  });
});

describe('movimentações e saldo da conta', () => {
  const t = (o: Partial<Transaction>): Transaction => ({
    id: 'x',
    description: 'x',
    amount: 100,
    type: 'expense',
    category: 'Outros',
    paymentMethod: 'pix',
    date: '2026-10-10',
    isFixed: false,
    isPaid: true,
    ...o,
  });

  it('movimentação fica fora de entradas e saídas do mês', () => {
    const month = summarizeMonth(
      [
        t({ type: 'income', amount: 6000, category: 'Salário' }),
        t({ amount: 3000, isTransfer: true, category: 'Investimentos' }),
        t({ type: 'income', amount: 1000, isTransfer: true, category: 'Transferências' }),
        t({ amount: 50 }),
      ],
      '2026-10',
    );
    expect(month).toEqual({ income: 6000, expense: 50, balance: 5950 });
  });

  it('saldo da conta soma só o que tem a tag dela, pago, depois da data informada, sem compra no cartão', () => {
    const inter = { id: 'inter', balance: 100, balanceDate: '2026-10-30' };
    const { balance, after } = accountBalance(inter, [
      t({ bankAccountId: 'inter', date: '2026-10-30', amount: 999 }), // no dia do saldo: já está nele
      t({ bankAccountId: 'inter', date: '2026-10-31', amount: 40 }),
      t({ bankAccountId: 'inter', date: '2026-10-31', type: 'income', amount: 200, isTransfer: true }),
      t({ bankAccountId: 'inter', date: '2026-10-31', amount: 70, paymentMethod: 'credit_card' }),
      t({ bankAccountId: 'inter', date: '2026-11-01', amount: 30, isPaid: false }),
      t({ bankAccountId: 'mp', date: '2026-10-31', amount: 500 }),
    ]);
    expect(balance).toBe(260);
    expect(after).toBe(2);
  });
});

describe('withoutHiddenCategories', () => {
  const rows = [{ category: 'Apostas' }, { category: 'Alimentação' }, { category: 'apostas ' }];

  it('tira as categorias ocultas, sem ligar para maiúsculas, acentos ou espaços', () => {
    expect(withoutHiddenCategories(rows, ['APOSTAS'])).toEqual([{ category: 'Alimentação' }]);
    expect(withoutHiddenCategories(rows, ['alimentacao'])).toHaveLength(2);
  });

  it('sem categorias ocultas devolve a mesma lista', () => {
    expect(withoutHiddenCategories(rows, [])).toBe(rows);
  });
});

describe('securedCardSavings', () => {
  const goals = [{ id: 'g1', currency: 'BRL' as const, currentAmount: 800 }];

  it('soma o limite dos cartões garantidos; cartão comum ou com limite vindo de caixinha fica de fora', () => {
    const r = securedCardSavings(
      [
        { id: 'inter', name: 'Inter', limit: 5120.24, limitSavingsGoalId: null, securedLimit: true },
        { id: 'mp', name: 'MP', limit: 500, limitSavingsGoalId: null, securedLimit: false },
        { id: 'x', name: 'X', limit: 100, limitSavingsGoalId: 'g1', securedLimit: true },
      ],
      goals,
    );
    expect(r.total).toBe(5120.24);
    expect(r.cards.map((c) => c.card.id)).toEqual(['inter']);
  });
});

describe('cardUsage: compra registrada depois do valor da fatura atual', () => {
  const tx = (o: Partial<Transaction>): Transaction => ({
    id: 'x',
    description: 'x',
    amount: 100,
    type: 'expense',
    category: 'Outros',
    paymentMethod: 'credit_card',
    creditCardId: 'inter',
    date: '2026-10-31',
    isFixed: false,
    isPaid: true,
    ...o,
  });
  const invoices = [
    {
      creditCardId: 'inter',
      closingDate: '2026-11-28',
      amount: 396.78,
      paymentDate: null,
      recordedAt: '2026-10-31T15:56:00.000Z',
    },
  ];

  it('soma a compra nova; a que já existia quando a fatura foi informada continua dentro dela', () => {
    const usage = cardUsage(
      'inter',
      [
        tx({ amount: 55, createdAt: '2026-10-31T18:22:00.000Z' }), // nova
        tx({ amount: 400, createdAt: '2026-10-31T18:22:01.000Z' }), // nova
        tx({ amount: 200, date: '2026-10-30', createdAt: '2026-10-31T14:49:00.000Z' }), // já no valor
        tx({ amount: 999 }), // sem createdAt: regra só pela data
      ],
      invoices,
      '2026-10-31',
    );
    expect(usage).toMatchObject({ unbilled: 455, openInvoices: 396.78, used: 851.78 });
  });
});

it('addDays atravessa mês e ano', () => {
  expect(addDays('2026-10-31', 1)).toBe('2026-11-01');
  expect(addDays('2026-01-01', -1)).toBe('2025-12-31');
});
