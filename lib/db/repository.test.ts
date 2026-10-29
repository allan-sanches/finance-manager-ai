import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { migrate } from 'drizzle-orm/pglite/migrator';
import { beforeEach, describe, expect, it } from 'vitest';

import * as repo from '@/lib/db/repository';
import * as schema from '@/lib/db/schema';
import { snapshotSchema } from '@/lib/finance-schemas';
import type { CreditCard, Debt, Transaction } from '@/types/finance';

// Postgres real em memória (PGlite) com as mesmas migrações do deploy.
let db: repo.Db;

beforeEach(async () => {
  const instance = drizzle({ client: new PGlite(), schema });
  await migrate(instance, { migrationsFolder: './drizzle' });
  db = instance as unknown as repo.Db;
});

const card = (overrides: Partial<CreditCard> = {}): CreditCard => ({
  id: 'card-1',
  name: 'Nubank',
  limit: 5000,
  closingDay: 5,
  dueDay: 12,
  currentInvoiceAmount: 0,
  ...overrides,
});

const tx = (overrides: Partial<Transaction> = {}): Transaction => ({
  id: 'tx-1',
  description: 'iFood',
  amount: 45.9,
  type: 'expense',
  category: 'Alimentação',
  paymentMethod: 'credit_card',
  creditCardId: 'card-1',
  date: '2026-10-28',
  isFixed: false,
  isPaid: false,
  ...overrides,
});

const invoice = async (id = 'card-1') =>
  (await repo.getSnapshot(db)).creditCards.find((c) => c.id === id)?.currentInvoiceAmount;

describe('transações e fatura', () => {
  beforeEach(async () => {
    await repo.addCreditCard(db, card());
    await repo.addCreditCard(db, card({ id: 'card-2', name: 'Inter' }));
  });

  it('soma na fatura ao lançar no crédito e preserva centavos', async () => {
    await repo.addTransaction(db, tx());
    await repo.addTransaction(db, tx({ id: 'tx-2', amount: 0.1 }));
    expect(await invoice()).toBe(46);
  });

  it('não mexe na fatura para outros meios de pagamento', async () => {
    await repo.addTransaction(db, tx({ paymentMethod: 'pix', creditCardId: null }));
    expect(await invoice()).toBe(0);
  });

  it('descarta cartão inexistente em vez de quebrar a FK', async () => {
    await repo.addTransaction(db, tx({ creditCardId: 'nao-existe' }));
    const snap = await repo.getSnapshot(db);
    expect(snap.transactions[0].creditCardId).toBeNull();
  });

  it('ajusta a fatura ao editar valor e ao trocar de cartão', async () => {
    await repo.addTransaction(db, tx({ amount: 100 }));
    await repo.updateTransaction(db, 'tx-1', { amount: 150 });
    expect(await invoice()).toBe(150);

    await repo.updateTransaction(db, 'tx-1', { creditCardId: 'card-2' });
    expect(await invoice('card-1')).toBe(0);
    expect(await invoice('card-2')).toBe(150);

    await repo.updateTransaction(db, 'tx-1', { paymentMethod: 'debit', creditCardId: null });
    expect(await invoice('card-2')).toBe(0);
  });

  it('desconta da fatura ao remover, sem ficar negativa', async () => {
    await repo.addTransaction(db, tx({ amount: 80 }));
    await repo.updateCreditCard(db, 'card-1', { name: 'Nu' });
    await repo.removeTransaction(db, 'tx-1');
    expect(await invoice()).toBe(0);
  });

  it('alterna isPaid', async () => {
    await repo.addTransaction(db, tx());
    await repo.toggleTransactionPaid(db, 'tx-1');
    expect((await repo.getSnapshot(db)).transactions[0].isPaid).toBe(true);
  });

  it('remover cartão desvincula as transações', async () => {
    await repo.addTransaction(db, tx());
    await repo.removeCreditCard(db, 'card-1');
    const snap = await repo.getSnapshot(db);
    expect(snap.creditCards.map((c) => c.id)).toEqual(['card-2']);
    expect(snap.transactions[0].creditCardId).toBeNull();
  });

  it('lista transações da mais nova para a mais antiga', async () => {
    await repo.addTransaction(db, tx({ id: 'a' }));
    await new Promise((r) => setTimeout(r, 5));
    await repo.addTransaction(db, tx({ id: 'b' }));
    expect((await repo.getSnapshot(db)).transactions.map((t) => t.id)).toEqual(['b', 'a']);
  });
});

describe('caixinhas e listas', () => {
  it('deposita e retira sem ficar negativo', async () => {
    await repo.addSavingsGoal(db, {
      id: 'g1',
      name: 'Viagem',
      targetAmount: 3000,
      currentAmount: 0,
      deadline: '2027-01-01',
    });
    await repo.depositToGoal(db, 'g1', 200.5);
    await repo.withdrawFromGoal(db, 'g1', 1000);
    const [goal] = (await repo.getSnapshot(db)).savingsGoals;
    expect(goal).toEqual({
      id: 'g1',
      name: 'Viagem',
      targetAmount: 3000,
      currentAmount: 0,
      deadline: '2027-01-01',
    });
  });

  it('mantém priority opcional e alterna isPurchased', async () => {
    await repo.addShoppingItem(db, {
      id: 'i1',
      name: 'Arroz',
      listType: 'household',
      estimatedPrice: null,
      isPurchased: false,
    });
    await repo.toggleShoppingItem(db, 'i1');
    const [item] = (await repo.getSnapshot(db)).shoppingItems;
    expect(item).toEqual({
      id: 'i1',
      name: 'Arroz',
      listType: 'household',
      estimatedPrice: null,
      isPurchased: true,
    });
  });
});

describe('importSnapshot', () => {
  // Passa pelo mesmo schema que a Server Action usa.
  const legacy = snapshotSchema.parse({
    creditCards: [card({ currentInvoiceAmount: 45.9 })],
    transactions: [tx({ id: 'novo' }), tx({ id: 'velho', creditCardId: 'sumiu' })],
  });

  it('importa mantendo fatura e ordem, e descarta cartão órfão', async () => {
    await repo.importSnapshot(db, legacy);
    const snap = await repo.getSnapshot(db);
    expect(snap.creditCards[0].currentInvoiceAmount).toBe(45.9);
    expect(snap.transactions.map((t) => t.id)).toEqual(['novo', 'velho']);
    expect(snap.transactions[1].creditCardId).toBeNull();
  });

  it('é idempotente', async () => {
    await repo.importSnapshot(db, legacy);
    await repo.importSnapshot(db, legacy);
    const snap = await repo.getSnapshot(db);
    expect(snap.transactions).toHaveLength(2);
    expect(snap.creditCards).toHaveLength(1);
  });

  it('importa volumes acima do tamanho de lote', async () => {
    const many = snapshotSchema.parse({
      transactions: Array.from({ length: 1200 }, (_, i) =>
        tx({ id: `t${i}`, paymentMethod: 'pix', creditCardId: null }),
      ),
    });
    await repo.importSnapshot(db, many);
    expect((await repo.getSnapshot(db)).transactions).toHaveLength(1200);
  });
});

describe('importação de extrato', () => {
  beforeEach(async () => {
    await repo.addCreditCard(db, card());
  });

  it('grava o lote numa transação e soma o crédito na fatura do cartão', async () => {
    await repo.addTransactions(db, [
      tx({ id: 'a', amount: 10 }),
      tx({ id: 'b', amount: 20.5 }),
      tx({ id: 'c', amount: 99, paymentMethod: 'pix', creditCardId: null }),
      tx({ id: 'd', amount: 5, creditCardId: 'nao-existe' }),
    ]);
    const snap = await repo.getSnapshot(db);
    expect(snap.transactions.map((t) => t.id)).toEqual(['a', 'b', 'c', 'd']);
    expect(snap.transactions[3].creditCardId).toBeNull();
    expect(await invoice()).toBe(30.5);
  });

  it('não grava nada se uma linha falhar', async () => {
    await repo.addTransaction(db, tx({ id: 'existe', paymentMethod: 'pix', creditCardId: null }));
    await expect(
      repo.addTransactions(db, [tx({ id: 'novo', amount: 10 }), tx({ id: 'existe' })]),
    ).rejects.toThrow();
    const snap = await repo.getSnapshot(db);
    expect(snap.transactions.map((t) => t.id)).toEqual(['existe']);
    expect(await invoice()).toBe(0);
  });
});

describe('dívidas', () => {
  const debt = (overrides: Partial<Debt> = {}): Debt => ({
    id: 'd1',
    creditor: 'BANCO EXEMPLO S.A.',
    description: 'Outros empréstimos',
    source: 'scr',
    currentAmount: 653.92,
    overdueAmount: 0,
    referenceDate: '2026-09-01',
    ...overrides,
  });

  it('um relatório novo substitui só as dívidas da mesma origem', async () => {
    await repo.replaceDebts(db, 'scr', [debt(), debt({ id: 'd2' })]);
    await repo.replaceDebts(db, 'serasa', [
      debt({ id: 's1', source: 'serasa', currentAmount: 0, overdueAmount: 120 }),
    ]);
    await repo.replaceDebts(db, 'scr', [debt({ id: 'd3', overdueAmount: 203.01 })]);

    const snap = await repo.getSnapshot(db);
    expect(snap.debts.map((d) => d.id).sort()).toEqual(['d3', 's1']);
    expect(snap.debts.find((d) => d.id === 'd3')).toEqual(debt({ id: 'd3', overdueAmount: 203.01 }));
  });

  it('remove uma dívida', async () => {
    await repo.replaceDebts(db, 'scr', [debt()]);
    await repo.removeDebt(db, 'd1');
    expect((await repo.getSnapshot(db)).debts).toEqual([]);
  });
});
