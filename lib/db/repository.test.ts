import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { migrate } from 'drizzle-orm/pglite/migrator';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import * as repo from '@/lib/db/repository';
import * as schema from '@/lib/db/schema';
import { snapshotSchema } from '@/lib/finance-schemas';
import type { CreditCard, Debt, Transaction } from '@/types/finance';

// Postgres real em memória (PGlite) com as mesmas migrações do deploy.
// Subir um PGlite e migrar a cada teste leva alguns segundos em máquinas mais lentas.
vi.setConfig({ testTimeout: 30_000, hookTimeout: 30_000 });

let db: repo.Db;
const OWNER = repo.OWNER_ID;

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
  (await repo.getSnapshot(db, OWNER)).creditCards.find((c) => c.id === id)?.currentInvoiceAmount;

describe('transações e fatura', () => {
  beforeEach(async () => {
    await repo.addCreditCard(db, OWNER, card());
    await repo.addCreditCard(db, OWNER, card({ id: 'card-2', name: 'Inter' }));
  });

  it('soma na fatura ao lançar no crédito e preserva centavos', async () => {
    await repo.addTransaction(db, OWNER, tx());
    await repo.addTransaction(db, OWNER, tx({ id: 'tx-2', amount: 0.1 }));
    expect(await invoice()).toBe(46);
  });

  it('não mexe na fatura para outros meios de pagamento', async () => {
    await repo.addTransaction(db, OWNER, tx({ paymentMethod: 'pix', creditCardId: null }));
    expect(await invoice()).toBe(0);
  });

  it('descarta cartão inexistente em vez de quebrar a FK', async () => {
    await repo.addTransaction(db, OWNER, tx({ creditCardId: 'nao-existe' }));
    const snap = await repo.getSnapshot(db, OWNER);
    expect(snap.transactions[0].creditCardId).toBeNull();
  });

  it('ajusta a fatura ao editar valor e ao trocar de cartão', async () => {
    await repo.addTransaction(db, OWNER, tx({ amount: 100 }));
    await repo.updateTransaction(db, OWNER, 'tx-1', { amount: 150 });
    expect(await invoice()).toBe(150);

    await repo.updateTransaction(db, OWNER, 'tx-1', { creditCardId: 'card-2' });
    expect(await invoice('card-1')).toBe(0);
    expect(await invoice('card-2')).toBe(150);

    await repo.updateTransaction(db, OWNER, 'tx-1', { paymentMethod: 'debit', creditCardId: null });
    expect(await invoice('card-2')).toBe(0);
  });

  it('desconta da fatura ao remover, sem ficar negativa', async () => {
    await repo.addTransaction(db, OWNER, tx({ amount: 80 }));
    await repo.updateCreditCard(db, OWNER, 'card-1', { name: 'Nu' });
    await repo.removeTransaction(db, OWNER, 'tx-1');
    expect(await invoice()).toBe(0);
  });

  it('alterna isPaid', async () => {
    await repo.addTransaction(db, OWNER, tx());
    await repo.toggleTransactionPaid(db, OWNER, 'tx-1');
    expect((await repo.getSnapshot(db, OWNER)).transactions[0].isPaid).toBe(true);
  });

  it('remover cartão desvincula as transações', async () => {
    await repo.addTransaction(db, OWNER, tx());
    await repo.removeCreditCard(db, OWNER, 'card-1');
    const snap = await repo.getSnapshot(db, OWNER);
    expect(snap.creditCards.map((c) => c.id)).toEqual(['card-2']);
    expect(snap.transactions[0].creditCardId).toBeNull();
  });

  it('lista transações da mais nova para a mais antiga', async () => {
    await repo.addTransaction(db, OWNER, tx({ id: 'a' }));
    await new Promise((r) => setTimeout(r, 5));
    await repo.addTransaction(db, OWNER, tx({ id: 'b' }));
    expect((await repo.getSnapshot(db, OWNER)).transactions.map((t) => t.id)).toEqual(['b', 'a']);
  });
});

describe('caixinhas e listas', () => {
  it('deposita e retira sem ficar negativo', async () => {
    const viagem = {
      id: 'g1',
      name: 'Viagem',
      targetAmount: 3000,
      currentAmount: 0,
      deadline: '2027-01-01',
      institution: 'Inter',
      cdiPercent: 82,
      annualRate: null,
      currency: 'BRL' as const,
      lockDays: null,
      depositDate: null,
      monthlyContribution: 150,
      timeDeposits: [{ id: 'td1', amount: 100, maturityDate: '2026-11-26' }],
    };
    await repo.addSavingsGoal(db, OWNER, viagem);
    await repo.depositToGoal(db, OWNER, 'g1', 200.5);
    await repo.withdrawFromGoal(db, OWNER, 'g1', 1000);
    const [goal] = (await repo.getSnapshot(db, OWNER)).savingsGoals;
    expect(goal).toEqual(viagem);
  });

  it('depósito com data marca o resgate provável; editar o nome não muda a moeda', async () => {
    await repo.addSavingsGoal(db, OWNER, {
      id: 'usd',
      name: 'Porquinho em dólar',
      targetAmount: 1000,
      currentAmount: 0,
      currency: 'USD',
      lockDays: 30,
    });
    await repo.depositToGoal(db, OWNER, 'usd', 50, '2026-10-29');
    await repo.updateSavingsGoal(db, OWNER, 'usd', { name: 'Porquinho USD' });
    const [goal] = (await repo.getSnapshot(db, OWNER)).savingsGoals;
    expect(goal).toMatchObject({ name: 'Porquinho USD', currency: 'USD', currentAmount: 50, depositDate: '2026-10-29', lockDays: 30 });
  });

  it('mantém priority opcional e alterna isPurchased', async () => {
    await repo.addShoppingItem(db, OWNER, {
      id: 'i1',
      name: 'Arroz',
      listType: 'household',
      estimatedPrice: null,
      isPurchased: false,
    });
    await repo.toggleShoppingItem(db, OWNER, 'i1');
    const [item] = (await repo.getSnapshot(db, OWNER)).shoppingItems;
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
    await repo.importSnapshot(db, OWNER, legacy);
    const snap = await repo.getSnapshot(db, OWNER);
    expect(snap.creditCards[0].currentInvoiceAmount).toBe(45.9);
    expect(snap.transactions.map((t) => t.id)).toEqual(['novo', 'velho']);
    expect(snap.transactions[1].creditCardId).toBeNull();
  });

  it('é idempotente', async () => {
    await repo.importSnapshot(db, OWNER, legacy);
    await repo.importSnapshot(db, OWNER, legacy);
    const snap = await repo.getSnapshot(db, OWNER);
    expect(snap.transactions).toHaveLength(2);
    expect(snap.creditCards).toHaveLength(1);
  });

  it('importa volumes acima do tamanho de lote', async () => {
    const many = snapshotSchema.parse({
      transactions: Array.from({ length: 1200 }, (_, i) =>
        tx({ id: `t${i}`, paymentMethod: 'pix', creditCardId: null }),
      ),
    });
    await repo.importSnapshot(db, OWNER, many);
    expect((await repo.getSnapshot(db, OWNER)).transactions).toHaveLength(1200);
  });
});

describe('importação de extrato', () => {
  beforeEach(async () => {
    await repo.addCreditCard(db, OWNER, card());
  });

  it('grava o lote numa transação e soma o crédito na fatura do cartão', async () => {
    await repo.addTransactions(db, OWNER, [
      tx({ id: 'a', amount: 10 }),
      tx({ id: 'b', amount: 20.5 }),
      tx({ id: 'c', amount: 99, paymentMethod: 'pix', creditCardId: null }),
      tx({ id: 'd', amount: 5, creditCardId: 'nao-existe' }),
    ]);
    const snap = await repo.getSnapshot(db, OWNER);
    expect(snap.transactions.map((t) => t.id)).toEqual(['a', 'b', 'c', 'd']);
    expect(snap.transactions[3].creditCardId).toBeNull();
    expect(await invoice()).toBe(30.5);
  });

  it('não grava nada se uma linha falhar', async () => {
    await repo.addTransaction(db, OWNER, tx({ id: 'existe', paymentMethod: 'pix', creditCardId: null }));
    await expect(
      repo.addTransactions(db, OWNER, [tx({ id: 'novo', amount: 10 }), tx({ id: 'existe' })]),
    ).rejects.toThrow();
    const snap = await repo.getSnapshot(db, OWNER);
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
    status: 'active',
    notes: null,
    ...overrides,
  });

  it('um relatório novo substitui só as dívidas da mesma origem', async () => {
    await repo.replaceDebts(db, OWNER, 'scr', [debt(), debt({ id: 'd2' })]);
    await repo.replaceDebts(db, OWNER, 'serasa', [
      debt({ id: 's1', source: 'serasa', currentAmount: 0, overdueAmount: 120 }),
    ]);
    await repo.replaceDebts(db, OWNER, 'scr', [debt({ id: 'd3', overdueAmount: 203.01 })]);

    const snap = await repo.getSnapshot(db, OWNER);
    expect(snap.debts.map((d) => d.id).sort()).toEqual(['d3', 's1']);
    expect(snap.debts.find((d) => d.id === 'd3')).toEqual(debt({ id: 'd3', overdueAmount: 203.01 }));
  });

  it('mantém status e anotação quando o relatório novo traz a mesma dívida', async () => {
    await repo.replaceDebts(db, OWNER, 'scr', [debt()]);
    await repo.updateDebt(db, OWNER, 'd1', { status: 'abandoned', notes: 'prescreve em 2027' });
    await repo.replaceDebts(db, OWNER, 'scr', [debt({ id: 'novo', currentAmount: 600 })]);
    const [d] = (await repo.getSnapshot(db, OWNER)).debts;
    expect(d).toMatchObject({ id: 'novo', currentAmount: 600, status: 'abandoned', notes: 'prescreve em 2027' });
  });

  it('dívida manual e preferência do dashboard', async () => {
    await repo.addDebt(db, OWNER, debt({ id: 'm1', source: 'manual', creditor: 'Simplic' }));
    await repo.updateSettings(db, OWNER, { dashboardDebtStatuses: ['active'] });
    const snap = await repo.getSnapshot(db, OWNER);
    expect(snap.debts.map((x) => x.source)).toEqual(['manual']);
    expect(snap.settings.dashboardDebtStatuses).toEqual(['active']);
  });

  it('remove uma dívida', async () => {
    await repo.replaceDebts(db, OWNER, 'scr', [debt()]);
    await repo.removeDebt(db, OWNER, 'd1');
    expect((await repo.getSnapshot(db, OWNER)).debts).toEqual([]);
  });
});

describe('categorias', () => {
  it('cria, ignora nome repetido (maiúsculas/acentos) e apaga sem mexer nos lançamentos', async () => {
    await repo.addCategory(db, OWNER, { id: 'k1', name: 'Pet', emoji: '🐾', tone: 'amber' });
    await repo.addCategory(db, OWNER, { id: 'k2', name: 'pét', emoji: '🐶', tone: 'red' });
    await repo.addTransaction(db, OWNER, tx({ category: 'Pet', paymentMethod: 'pix', creditCardId: null }));

    let snap = await repo.getSnapshot(db, OWNER);
    expect(snap.categories).toEqual([{ id: 'k1', name: 'Pet', emoji: '🐾', tone: 'amber' }]);
    expect(await repo.listCategoryNames(db, OWNER)).toContain('Pet');

    await repo.removeCategory(db, OWNER, 'k1');
    snap = await repo.getSnapshot(db, OWNER);
    expect(snap.categories).toEqual([]);
    expect(snap.transactions[0].category).toBe('Pet');
  });
});

describe('contas', () => {
  it('cria na ordem de cadastro, atualiza saldo (inclusive negativo) e apaga', async () => {
    await repo.addBankAccount(db, OWNER, { id: 'a1', name: 'Inter', balance: 1520.37, balanceDate: '2026-10-30' });
    await repo.addBankAccount(db, OWNER, { id: 'a2', name: 'Mercado Pago', balance: 80, balanceDate: '2026-10-30' });
    await repo.updateBankAccount(db, OWNER, 'a1', { balance: -45.5, balanceDate: '2026-10-31' });

    let snap = await repo.getSnapshot(db, OWNER);
    expect(snap.bankAccounts).toEqual([
      { id: 'a1', name: 'Inter', balance: -45.5, balanceDate: '2026-10-31' },
      { id: 'a2', name: 'Mercado Pago', balance: 80, balanceDate: '2026-10-30' },
    ]);

    await repo.removeBankAccount(db, OWNER, 'a2');
    snap = await repo.getSnapshot(db, OWNER);
    expect(snap.bankAccounts.map((a) => a.id)).toEqual(['a1']);
  });

  it('não mexe na conta de outra pessoa', async () => {
    await repo.createUser(db, { id: 'u2', email: 'outra@exemplo.com', passwordHash: 'scrypt$x' });
    await repo.addBankAccount(db, OWNER, { id: 'a1', name: 'Inter', balance: 100, balanceDate: '2026-10-30' });

    await repo.updateBankAccount(db, 'u2', 'a1', { balance: 0 });
    await repo.removeBankAccount(db, 'u2', 'a1');

    expect((await repo.getSnapshot(db, 'u2')).bankAccounts).toEqual([]);
    expect((await repo.getSnapshot(db, OWNER)).bankAccounts[0].balance).toBe(100);
  });
});

describe('usuários', () => {
  it('a migração cria o owner como admin, sem e-mail nem senha', async () => {
    expect(await repo.getUser(db, OWNER)).toEqual({ id: OWNER, email: null, passwordHash: null, isAdmin: true });
  });

  it('grava e-mail e senha sem um apagar o outro, acha pelo e-mail e não vaza no snapshot', async () => {
    await repo.updateUser(db, OWNER, { email: 'eu@exemplo.com' });
    await repo.updateUser(db, OWNER, { passwordHash: 'scrypt$hash' });
    expect(await repo.findUserByEmail(db, 'eu@exemplo.com')).toMatchObject({
      id: OWNER,
      passwordHash: 'scrypt$hash',
    });
    expect(JSON.stringify(await repo.getSnapshot(db, OWNER))).not.toContain('scrypt');
  });

  it('não deixa dois usuários com o mesmo e-mail', async () => {
    await repo.createUser(db, { id: 'u2', email: 'outra@exemplo.com', passwordHash: 'scrypt$x' });
    await expect(
      repo.createUser(db, { id: 'u3', email: 'outra@exemplo.com', passwordHash: 'scrypt$y' }),
    ).rejects.toThrow();
    expect((await repo.listUsers(db)).map((u) => u.id)).toEqual([OWNER, 'u2']);
  });
});

describe('isolamento entre usuários', () => {
  const OTHER = 'u2';

  beforeEach(async () => {
    await repo.createUser(db, { id: OTHER, email: 'outra@exemplo.com', passwordHash: 'scrypt$x' });
    await repo.addCreditCard(db, OWNER, card());
    await repo.addTransaction(db, OWNER, tx());
  });

  it('cada um só vê os próprios dados', async () => {
    await repo.addCategory(db, OTHER, { id: 'k2', name: 'Pet', emoji: '🐾', tone: 'amber' });
    await repo.updateSettings(db, OTHER, { dashboardDebtStatuses: ['active'] });

    const other = await repo.getSnapshot(db, OTHER);
    expect(other.transactions).toEqual([]);
    expect(other.creditCards).toEqual([]);
    expect(other.categories.map((c) => c.name)).toEqual(['Pet']);

    const mine = await repo.getSnapshot(db, OWNER);
    expect(mine.transactions).toHaveLength(1);
    expect(mine.categories).toEqual([]);
    expect(mine.settings.dashboardDebtStatuses).not.toEqual(['active']);
    expect(other.settings.dashboardDebtStatuses).toEqual(['active']);
  });

  it('a mesma categoria pode existir para os dois', async () => {
    await repo.addCategory(db, OWNER, { id: 'k1', name: 'Pet', emoji: '🐾', tone: 'amber' });
    await repo.addCategory(db, OTHER, { id: 'k2', name: 'Pet', emoji: '🐶', tone: 'lime' });
    expect((await repo.getSnapshot(db, OTHER)).categories).toHaveLength(1);
  });

  it('não altera nem apaga dados de outra pessoa pelo id', async () => {
    await repo.updateTransaction(db, OTHER, 'tx-1', { amount: 1 });
    await repo.toggleTransactionPaid(db, OTHER, 'tx-1');
    await repo.removeTransaction(db, OTHER, 'tx-1');
    await repo.updateCreditCard(db, OTHER, 'card-1', { name: 'Hackeado' });
    await repo.removeCreditCard(db, OTHER, 'card-1');

    const mine = await repo.getSnapshot(db, OWNER);
    expect(mine.transactions[0]).toMatchObject({ id: 'tx-1', amount: 45.9, isPaid: false });
    expect(mine.creditCards[0]).toMatchObject({ name: 'Nubank', currentInvoiceAmount: 45.9 });
  });

  it('não lança nem cria fatura no cartão de outra pessoa', async () => {
    await repo.addTransaction(db, OTHER, tx({ id: 'tx-other', amount: 100 }));
    await repo.addCreditCardInvoice(db, OTHER, {
      id: 'inv-other',
      creditCardId: 'card-1',
      closingDate: '2026-11-05',
      dueDate: '2026-11-12',
      amount: 45.9,
      paymentDate: '2026-11-10',
    });

    const other = await repo.getSnapshot(db, OTHER);
    expect(other.transactions[0].creditCardId).toBeNull();
    expect(other.creditCardInvoices).toEqual([]);
    expect(await invoice()).toBe(45.9);
  });

  it('situações de dívida editadas por um não mudam as do outro', async () => {
    const custom = [{ id: 'active', label: 'Pendente', tone: 'red' as const }];
    await repo.updateSettings(db, OTHER, { debtStatuses: custom });

    expect((await repo.getSnapshot(db, OTHER)).settings.debtStatuses).toEqual(custom);
    expect((await repo.getSnapshot(db, OWNER)).settings.debtStatuses.map((s) => s.label)).toContain('Em aberto');
  });

  it('não paga, edita nem apaga fatura, caixinha, item ou dívida de outra pessoa', async () => {
    await repo.addCreditCardInvoice(db, OWNER, {
      id: 'inv-1',
      creditCardId: 'card-1',
      closingDate: '2026-11-05',
      dueDate: '2026-11-12',
      amount: 45.9,
      paymentDate: null,
    });
    await repo.addSavingsGoal(db, OWNER, {
      id: 'g1',
      name: 'Reserva',
      targetAmount: 1000,
      currentAmount: 0,
      currency: 'BRL',
    });
    await repo.depositToGoal(db, OWNER, 'g1', 100);
    await repo.addShoppingItem(db, OWNER, { id: 'i1', name: 'Arroz', listType: 'household', isPurchased: false });
    await repo.addDebt(db, OWNER, {
      id: 'd1',
      creditor: 'Banco',
      description: 'Empréstimo',
      source: 'manual',
      currentAmount: 500,
      overdueAmount: 0,
      referenceDate: '2026-10-01',
      status: 'active',
    });

    await repo.updateCreditCardInvoice(db, OTHER, 'inv-1', { paymentDate: '2026-11-10', amount: 1 });
    await repo.removeCreditCardInvoice(db, OTHER, 'inv-1');
    await repo.withdrawFromGoal(db, OTHER, 'g1', 100);
    await repo.depositToGoal(db, OTHER, 'g1', 999);
    await repo.removeSavingsGoal(db, OTHER, 'g1');
    await repo.toggleShoppingItem(db, OTHER, 'i1');
    await repo.removeShoppingItem(db, OTHER, 'i1');
    await repo.updateDebt(db, OTHER, 'd1', { status: 'paid' });
    await repo.removeDebt(db, OTHER, 'd1');
    await repo.replaceDebts(db, OTHER, 'manual', []);

    const mine = await repo.getSnapshot(db, OWNER);
    expect(mine.creditCardInvoices[0]).toMatchObject({ id: 'inv-1', amount: 45.9, paymentDate: null });
    expect(mine.savingsGoals[0]).toMatchObject({ id: 'g1', currentAmount: 100 });
    expect(mine.shoppingItems[0]).toMatchObject({ id: 'i1', isPurchased: false });
    expect(mine.debts[0]).toMatchObject({ id: 'd1', status: 'active' });
  });

  it('importação em lote não usa o cartão de outra pessoa', async () => {
    await repo.addTransactions(db, OTHER, [tx({ id: 'tx-batch', amount: 300 })]);

    expect((await repo.getSnapshot(db, OTHER)).transactions[0].creditCardId).toBeNull();
    expect(await invoice()).toBe(45.9);
  });

  it('importar dados antigos com id de outra pessoa não sobrescreve nem rouba o registro', async () => {
    const data = snapshotSchema.parse({
      transactions: [tx({ amount: 1, creditCardId: null })],
      creditCards: [card({ name: 'Roubado' })],
    });
    await repo.importSnapshot(db, OTHER, data);

    const mine = await repo.getSnapshot(db, OWNER);
    expect(mine.transactions[0]).toMatchObject({ id: 'tx-1', amount: 45.9 });
    expect(mine.creditCards[0].name).toBe('Nubank');
    const other = await repo.getSnapshot(db, OTHER);
    expect(other.transactions).toEqual([]);
    expect(other.creditCards).toEqual([]);
  });
});

describe('faturas do cartão', () => {
  const inv = {
    id: 'inv-1',
    creditCardId: 'card-1',
    closingDate: '2026-11-05',
    dueDate: '2026-11-12',
    amount: 300,
    paymentDate: null,
  };

  beforeEach(async () => {
    await repo.addCreditCard(db, OWNER, card({ currentInvoiceAmount: 500 }));
  });

  it('fatura em aberto não mexe no saldo; pagar desconta e desfazer devolve', async () => {
    await repo.addCreditCardInvoice(db, OWNER, inv);
    expect(await invoice()).toBe(500);
    await repo.updateCreditCardInvoice(db, OWNER, 'inv-1', { paymentDate: '2026-11-10' });
    expect(await invoice()).toBe(200);
    await repo.updateCreditCardInvoice(db, OWNER, 'inv-1', { amount: 350 });
    expect(await invoice()).toBe(150);
    await repo.updateCreditCardInvoice(db, OWNER, 'inv-1', { paymentDate: null });
    expect(await invoice()).toBe(500);
  });

  it('lança já paga e devolve o valor ao apagar', async () => {
    await repo.addCreditCardInvoice(db, OWNER, { ...inv, paymentDate: '2026-11-10' });
    expect(await invoice()).toBe(200);
    expect((await repo.getSnapshot(db, OWNER)).creditCardInvoices).toEqual([
      { ...inv, paymentDate: '2026-11-10' },
    ]);
    await repo.removeCreditCardInvoice(db, OWNER, 'inv-1');
    expect(await invoice()).toBe(500);
  });

  it('apagar o cartão apaga as faturas dele', async () => {
    await repo.addCreditCardInvoice(db, OWNER, inv);
    await repo.removeCreditCard(db, OWNER, 'card-1');
    expect((await repo.getSnapshot(db, OWNER)).creditCardInvoices).toEqual([]);
  });
});
