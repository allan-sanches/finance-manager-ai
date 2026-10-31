import { and, asc, desc, eq, sql } from 'drizzle-orm';
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core';

import * as schema from '@/lib/db/schema';
import { DEFAULT_SETTINGS, mergeCategoryNames } from '@/lib/finance';
import type { SnapshotInput } from '@/lib/finance-schemas';
import { normalizeCategoryName } from '@/lib/tones';
import type {
  AppSettings,
  BankAccount,
  Category,
  CreditCard,
  CreditCardInvoice,
  Debt,
  DebtSource,
  FinanceSnapshot,
  SavingsGoal,
  ShoppingItem,
  Transaction,
} from '@/types/finance';

// Recebe o db por parâmetro para os testes rodarem com PGlite e a aplicação com postgres-js.
export type Db = PgDatabase<PgQueryResultHKT, typeof schema>;
type Executor = Pick<Db, 'select' | 'insert' | 'update' | 'delete'>;

const {
  bankAccounts,
  categories,
  creditCardInvoices,
  creditCards,
  debts,
  savingsGoals,
  settings,
  shoppingItems,
  transactions,
  users,
} = schema;

// Toda função de dados recebe o userId da sessão e só enxerga as linhas dele. Os IDs são únicos no
// banco inteiro, então filtrar só pelo id deixaria uma pessoa mexer no dado da outra.

const ownTransaction = (userId: string, id: string) =>
  and(eq(transactions.userId, userId), eq(transactions.id, id));
const ownCard = (userId: string, id: string) =>
  and(eq(creditCards.userId, userId), eq(creditCards.id, id));
const ownInvoice = (userId: string, id: string) =>
  and(eq(creditCardInvoices.userId, userId), eq(creditCardInvoices.id, id));
const ownAccount = (userId: string, id: string) =>
  and(eq(bankAccounts.userId, userId), eq(bankAccounts.id, id));
const ownGoal = (userId: string, id: string) =>
  and(eq(savingsGoals.userId, userId), eq(savingsGoals.id, id));
const ownItem = (userId: string, id: string) =>
  and(eq(shoppingItems.userId, userId), eq(shoppingItems.id, id));
const ownDebt = (userId: string, id: string) => and(eq(debts.userId, userId), eq(debts.id, id));
const ownCategory = (userId: string, id: string) =>
  and(eq(categories.userId, userId), eq(categories.id, id));

async function readSettings(db: Pick<Db, 'select'>, userId: string): Promise<AppSettings> {
  const rows = await db.select().from(settings).where(eq(settings.userId, userId));
  const stored = Object.fromEntries(rows.map((r) => [r.key, r.value])) as Partial<AppSettings>;
  return { ...DEFAULT_SETTINGS, ...stored };
}

export async function getSnapshot(db: Db, userId: string): Promise<FinanceSnapshot> {
  const [txRows, cardRows, invoiceRows, accountRows, goalRows, itemRows, debtRows, categoryRows, appSettings] = await Promise.all([
    db
      .select()
      .from(transactions)
      .where(eq(transactions.userId, userId))
      .orderBy(desc(transactions.createdAt), desc(transactions.id)),
    db
      .select()
      .from(creditCards)
      .where(eq(creditCards.userId, userId))
      .orderBy(asc(creditCards.createdAt), asc(creditCards.id)),
    db
      .select()
      .from(creditCardInvoices)
      .where(eq(creditCardInvoices.userId, userId))
      .orderBy(desc(creditCardInvoices.closingDate), desc(creditCardInvoices.id)),
    db
      .select()
      .from(bankAccounts)
      .where(eq(bankAccounts.userId, userId))
      .orderBy(asc(bankAccounts.createdAt), asc(bankAccounts.id)),
    db
      .select()
      .from(savingsGoals)
      .where(eq(savingsGoals.userId, userId))
      .orderBy(asc(savingsGoals.createdAt), asc(savingsGoals.id)),
    db
      .select()
      .from(shoppingItems)
      .where(eq(shoppingItems.userId, userId))
      .orderBy(desc(shoppingItems.createdAt), desc(shoppingItems.id)),
    db
      .select()
      .from(debts)
      .where(eq(debts.userId, userId))
      .orderBy(asc(debts.createdAt), asc(debts.id)),
    db
      .select()
      .from(categories)
      .where(eq(categories.userId, userId))
      .orderBy(asc(categories.createdAt), asc(categories.id)),
    readSettings(db, userId),
  ]);

  return {
    transactions: txRows.map(
      ({ createdAt: _, userId: __, ...t }): Transaction => ({
        ...t,
        creditCardId: t.creditCardId ?? null,
        bankAccountId: t.bankAccountId ?? null,
      }),
    ),
    creditCards: cardRows.map(({ createdAt: _, userId: __, ...c }): CreditCard => c),
    creditCardInvoices: invoiceRows.map(({ createdAt: _, userId: __, ...i }): CreditCardInvoice => i),
    bankAccounts: accountRows.map(({ createdAt: _, userId: __, ...a }): BankAccount => a),
    savingsGoals: goalRows.map(({ createdAt: _, userId: __, ...g }): SavingsGoal => g),
    shoppingItems: itemRows.map(
      ({ createdAt: _, userId: __, priority, ...i }): ShoppingItem => ({
        ...i,
        ...(priority ? { priority } : {}),
      }),
    ),
    debts: debtRows.map(({ createdAt: _, userId: __, ...d }): Debt => d),
    categories: categoryRows.map(({ createdAt: _, userId: __, ...c }): Category => c),
    settings: appSettings,
  };
}

// ---------- Transações + fatura do cartão ----------

const invoiceContribution = (t: Pick<Transaction, 'paymentMethod' | 'creditCardId' | 'amount'>) =>
  t.paymentMethod === 'credit_card' && t.creditCardId ? t.amount : 0;

async function adjustInvoice(
  db: Executor,
  userId: string,
  cardId: string | null | undefined,
  delta: number,
) {
  if (!cardId || delta === 0) return;
  await db
    .update(creditCards)
    .set({ currentInvoiceAmount: sql`greatest(0, ${creditCards.currentInvoiceAmount} + ${delta})` })
    .where(ownCard(userId, cardId));
}

/** Descarta creditCardId que não existe (ou é de outra pessoa), em vez de estourar a FK. */
async function existingCardId(db: Executor, userId: string, cardId: string | null | undefined) {
  if (!cardId) return null;
  const [row] = await db
    .select({ id: creditCards.id })
    .from(creditCards)
    .where(ownCard(userId, cardId));
  return row?.id ?? null;
}

/** Mesma ideia do existingCardId, para a tag de banco. */
async function existingAccountId(db: Executor, userId: string, accountId: string | null | undefined) {
  if (!accountId) return null;
  const [row] = await db
    .select({ id: bankAccounts.id })
    .from(bankAccounts)
    .where(ownAccount(userId, accountId));
  return row?.id ?? null;
}

async function userAccountIds(db: Executor, userId: string): Promise<Set<string>> {
  const rows = await db
    .select({ id: bankAccounts.id })
    .from(bankAccounts)
    .where(eq(bankAccounts.userId, userId));
  return new Set(rows.map((r) => r.id));
}

async function userCardIds(db: Executor, userId: string): Promise<Set<string>> {
  const rows = await db
    .select({ id: creditCards.id })
    .from(creditCards)
    .where(eq(creditCards.userId, userId));
  return new Set(rows.map((r) => r.id));
}

export async function addTransaction(db: Db, userId: string, input: Transaction): Promise<void> {
  await db.transaction(async (tx) => {
    const creditCardId = await existingCardId(tx, userId, input.creditCardId);
    const bankAccountId = await existingAccountId(tx, userId, input.bankAccountId);
    const row = { ...input, userId, creditCardId, bankAccountId };
    await tx.insert(transactions).values(row);
    await adjustInvoice(tx, userId, creditCardId, invoiceContribution(row));
  });
}

export async function updateTransaction(
  db: Db,
  userId: string,
  id: string,
  patch: Partial<Omit<Transaction, 'id'>>,
): Promise<void> {
  await db.transaction(async (tx) => {
    const [prev] = await tx.select().from(transactions).where(ownTransaction(userId, id)).for('update');
    if (!prev) return;
    const next = { ...prev, ...patch, id: prev.id };
    next.creditCardId = await existingCardId(tx, userId, next.creditCardId);
    next.bankAccountId = await existingAccountId(tx, userId, next.bankAccountId);

    await tx
      .update(transactions)
      .set({
        description: next.description,
        amount: next.amount,
        type: next.type,
        category: next.category,
        paymentMethod: next.paymentMethod,
        creditCardId: next.creditCardId,
        bankAccountId: next.bankAccountId,
        date: next.date,
        isFixed: next.isFixed,
        isPaid: next.isPaid,
      })
      .where(ownTransaction(userId, id));

    if (prev.creditCardId === next.creditCardId) {
      await adjustInvoice(tx, userId, next.creditCardId, invoiceContribution(next) - invoiceContribution(prev));
    } else {
      await adjustInvoice(tx, userId, prev.creditCardId, -invoiceContribution(prev));
      await adjustInvoice(tx, userId, next.creditCardId, invoiceContribution(next));
    }
  });
}

/**
 * Lançamentos de um extrato importado, numa única transação do banco: ou entram todos, ou nenhum.
 * A fatura de cada cartão recebe a soma dos lançamentos no crédito, como no addTransaction.
 */
export async function addTransactions(db: Db, userId: string, inputs: Transaction[]): Promise<void> {
  // createdAt decrescente para a lista ficar na ordem do arquivo (mais novo primeiro).
  const base = Date.now();
  await db.transaction(async (tx) => {
    const cardIds = await userCardIds(tx, userId);
    const accountIds = await userAccountIds(tx, userId);
    const rows = inputs.map((t, i) => ({
      ...t,
      userId,
      creditCardId: t.creditCardId && cardIds.has(t.creditCardId) ? t.creditCardId : null,
      bankAccountId: t.bankAccountId && accountIds.has(t.bankAccountId) ? t.bankAccountId : null,
      createdAt: new Date(base - i),
    }));
    for (const part of chunk(rows)) {
      await tx.insert(transactions).values(part);
    }

    const invoiceDelta = new Map<string, number>();
    for (const row of rows) {
      if (!row.creditCardId) continue;
      invoiceDelta.set(
        row.creditCardId,
        (invoiceDelta.get(row.creditCardId) ?? 0) + invoiceContribution(row),
      );
    }
    for (const [cardId, delta] of invoiceDelta) await adjustInvoice(tx, userId, cardId, delta);
  });
}

export async function removeTransaction(db: Db, userId: string, id: string): Promise<void> {
  await db.transaction(async (tx) => {
    const [prev] = await tx.delete(transactions).where(ownTransaction(userId, id)).returning();
    if (prev) await adjustInvoice(tx, userId, prev.creditCardId, -invoiceContribution(prev));
  });
}

export async function toggleTransactionPaid(db: Db, userId: string, id: string): Promise<void> {
  await db
    .update(transactions)
    .set({ isPaid: sql`not ${transactions.isPaid}` })
    .where(ownTransaction(userId, id));
}

// ---------- Cartões ----------

export async function addCreditCard(db: Db, userId: string, input: CreditCard): Promise<void> {
  await db.insert(creditCards).values({ ...input, userId });
}

export async function updateCreditCard(
  db: Db,
  userId: string,
  id: string,
  patch: Partial<Omit<CreditCard, 'id' | 'currentInvoiceAmount'>>,
): Promise<void> {
  if (Object.keys(patch).length === 0) return;
  await db.update(creditCards).set(patch).where(ownCard(userId, id));
}

/** A FK com ON DELETE SET NULL desvincula as transações do cartão removido. */
export async function removeCreditCard(db: Db, userId: string, id: string): Promise<void> {
  await db.delete(creditCards).where(ownCard(userId, id));
}

// ---------- Faturas ----------

// O que está em currentInvoiceAmount é o que ainda não foi pago: fatura paga sai dali.
const paidContribution = (i: Pick<CreditCardInvoice, 'paymentDate' | 'amount'>) =>
  i.paymentDate ? i.amount : 0;

/** Fatura de um cartão que não é da pessoa é ignorada. */
export async function addCreditCardInvoice(
  db: Db,
  userId: string,
  input: CreditCardInvoice,
): Promise<void> {
  await db.transaction(async (tx) => {
    if (!(await existingCardId(tx, userId, input.creditCardId))) return;
    await tx.insert(creditCardInvoices).values({ ...input, userId });
    await adjustInvoice(tx, userId, input.creditCardId, -paidContribution(input));
  });
}

export async function updateCreditCardInvoice(
  db: Db,
  userId: string,
  id: string,
  patch: Partial<Omit<CreditCardInvoice, 'id' | 'creditCardId'>>,
): Promise<void> {
  if (Object.keys(patch).length === 0) return;
  await db.transaction(async (tx) => {
    const [prev] = await tx
      .select()
      .from(creditCardInvoices)
      .where(ownInvoice(userId, id))
      .for('update');
    if (!prev) return;
    await tx.update(creditCardInvoices).set(patch).where(ownInvoice(userId, id));
    const next = { ...prev, ...patch };
    await adjustInvoice(tx, userId, prev.creditCardId, paidContribution(prev) - paidContribution(next));
  });
}

/** Apagar uma fatura paga devolve o valor ao saldo do cartão. */
export async function removeCreditCardInvoice(db: Db, userId: string, id: string): Promise<void> {
  await db.transaction(async (tx) => {
    const [prev] = await tx.delete(creditCardInvoices).where(ownInvoice(userId, id)).returning();
    if (prev) await adjustInvoice(tx, userId, prev.creditCardId, paidContribution(prev));
  });
}

// ---------- Contas ----------

export async function addBankAccount(db: Db, userId: string, input: BankAccount): Promise<void> {
  await db.insert(bankAccounts).values({ ...input, userId });
}

export async function updateBankAccount(
  db: Db,
  userId: string,
  id: string,
  patch: Partial<Omit<BankAccount, 'id'>>,
): Promise<void> {
  if (Object.keys(patch).length === 0) return;
  await db.update(bankAccounts).set(patch).where(ownAccount(userId, id));
}

export async function removeBankAccount(db: Db, userId: string, id: string): Promise<void> {
  await db.delete(bankAccounts).where(ownAccount(userId, id));
}

// ---------- Caixinhas ----------

export async function addSavingsGoal(db: Db, userId: string, input: SavingsGoal): Promise<void> {
  await db.insert(savingsGoals).values({ ...input, userId });
}

/** depositDate: só para caixinhas com prazo de resgate — o resgate provável conta a partir dele. */
export async function depositToGoal(
  db: Db,
  userId: string,
  id: string,
  amount: number,
  depositDate?: string,
): Promise<void> {
  await db
    .update(savingsGoals)
    .set({
      currentAmount: sql`${savingsGoals.currentAmount} + ${amount}`,
      ...(depositDate ? { depositDate } : {}),
    })
    .where(ownGoal(userId, id));
}

export async function withdrawFromGoal(db: Db, userId: string, id: string, amount: number): Promise<void> {
  await db
    .update(savingsGoals)
    .set({ currentAmount: sql`greatest(0, ${savingsGoals.currentAmount} - ${amount})` })
    .where(ownGoal(userId, id));
}

export async function updateSavingsGoal(
  db: Db,
  userId: string,
  id: string,
  patch: Partial<Omit<SavingsGoal, 'id' | 'currentAmount'>>,
): Promise<void> {
  if (Object.keys(patch).length === 0) return;
  await db.update(savingsGoals).set(patch).where(ownGoal(userId, id));
}

export async function removeSavingsGoal(db: Db, userId: string, id: string): Promise<void> {
  await db.delete(savingsGoals).where(ownGoal(userId, id));
}

// ---------- Listas ----------

export async function addShoppingItem(db: Db, userId: string, input: ShoppingItem): Promise<void> {
  await db.insert(shoppingItems).values({ ...input, userId, priority: input.priority ?? null });
}

export async function toggleShoppingItem(db: Db, userId: string, id: string): Promise<void> {
  await db
    .update(shoppingItems)
    .set({ isPurchased: sql`not ${shoppingItems.isPurchased}` })
    .where(ownItem(userId, id));
}

export async function updateShoppingItem(
  db: Db,
  userId: string,
  id: string,
  patch: Partial<Omit<ShoppingItem, 'id'>>,
): Promise<void> {
  if (Object.keys(patch).length === 0) return;
  await db.update(shoppingItems).set(patch).where(ownItem(userId, id));
}

export async function removeShoppingItem(db: Db, userId: string, id: string): Promise<void> {
  await db.delete(shoppingItems).where(ownItem(userId, id));
}

// ---------- Categorias do usuário ----------

const userCategoryRows = (db: Pick<Db, 'select'>, userId: string) =>
  db.select({ name: categories.name }).from(categories).where(eq(categories.userId, userId));

/** Nome repetido (mesmo nome, diferença só de maiúsculas/acentos) é ignorado: a categoria já existe. */
export async function addCategory(db: Db, userId: string, input: Category): Promise<void> {
  const key = normalizeCategoryName(input.name);
  const existing = await userCategoryRows(db, userId);
  if (existing.some((c) => normalizeCategoryName(c.name) === key)) return;
  await db.insert(categories).values({ ...input, userId }).onConflictDoNothing();
}

/** Nomes para os prompts da IA: padrão + as do usuário. */
export async function listCategoryNames(db: Db, userId: string): Promise<string[]> {
  return mergeCategoryNames(await userCategoryRows(db, userId));
}

/** Os lançamentos guardam o nome da categoria, então continuam intactos. */
export async function removeCategory(db: Db, userId: string, id: string): Promise<void> {
  await db.delete(categories).where(ownCategory(userId, id));
}

// ---------- Dívidas (Registrato/SCR e Serasa) ----------

/** Um relatório novo é a foto atual: apaga as dívidas daquela origem e grava as do relatório. */
const debtKey = (d: Pick<Debt, 'creditor' | 'description'>) =>
  `${normalizeCategoryName(d.creditor)}|${normalizeCategoryName(d.description)}`;

/**
 * Um relatório novo é a foto atual: apaga as dívidas daquela origem e grava as do relatório.
 * Status e anotações que o usuário deu a uma dívida (mesmo credor + modalidade) são mantidos.
 */
export async function replaceDebts(
  db: Db,
  userId: string,
  source: DebtSource,
  inputs: Debt[],
): Promise<void> {
  const base = Date.now();
  const sameSource = and(eq(debts.userId, userId), eq(debts.source, source));
  await db.transaction(async (tx) => {
    const previous = await tx
      .select({ creditor: debts.creditor, description: debts.description, status: debts.status, notes: debts.notes })
      .from(debts)
      .where(sameSource);
    const kept = new Map(previous.map((d) => [debtKey(d), d]));
    await tx.delete(debts).where(sameSource);
    const rows = inputs.map((d, i) => {
      const old = kept.get(debtKey(d));
      return {
        ...d,
        userId,
        source,
        status: old?.status ?? d.status,
        notes: old?.notes ?? d.notes ?? null,
        createdAt: new Date(base + i),
      };
    });
    for (const part of chunk(rows)) {
      await tx.insert(debts).values(part);
    }
  });
}

export async function removeDebt(db: Db, userId: string, id: string): Promise<void> {
  await db.delete(debts).where(ownDebt(userId, id));
}

/** Dívida cadastrada à mão (origem "manual"). */
export async function addDebt(db: Db, userId: string, input: Debt): Promise<void> {
  await db.insert(debts).values({ ...input, userId, notes: input.notes ?? null });
}

export async function updateDebt(
  db: Db,
  userId: string,
  id: string,
  patch: Partial<Omit<Debt, 'id' | 'source'>>,
): Promise<void> {
  if (Object.keys(patch).length === 0) return;
  await db.update(debts).set(patch).where(ownDebt(userId, id));
}

// ---------- Preferências ----------

export async function updateSettings(db: Db, userId: string, patch: Partial<AppSettings>): Promise<void> {
  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined) continue;
    await db
      .insert(settings)
      .values({ userId, key, value })
      .onConflictDoUpdate({ target: [settings.userId, settings.key], set: { value } });
  }
}

// ---------- Usuários ----------

/** A conta original, dona dos dados de antes do multiusuário. */
export const OWNER_ID = 'owner';

export type UserRecord = {
  id: string;
  email: string | null;
  passwordHash: string | null;
  isAdmin: boolean;
};

const userColumns = {
  id: users.id,
  email: users.email,
  passwordHash: users.passwordHash,
  isAdmin: users.isAdmin,
};

export async function getUser(db: Db, id: string): Promise<UserRecord | null> {
  const [row] = await db.select(userColumns).from(users).where(eq(users.id, id));
  return row ?? null;
}

/** O e-mail fica gravado em minúsculas: quem chama já manda normalizado. */
export async function findUserByEmail(db: Db, email: string): Promise<UserRecord | null> {
  const [row] = await db.select(userColumns).from(users).where(eq(users.email, email));
  return row ?? null;
}

/** Para a tela de perfil do admin: sem o hash. */
export async function listUsers(db: Db): Promise<Omit<UserRecord, 'passwordHash'>[]> {
  return db
    .select({ id: users.id, email: users.email, isAdmin: users.isAdmin })
    .from(users)
    .orderBy(asc(users.createdAt), asc(users.id));
}

export async function createUser(
  db: Db,
  input: { id: string; email: string; passwordHash: string },
): Promise<void> {
  await db.insert(users).values({ ...input, isAdmin: false });
}

export async function updateUser(
  db: Db,
  id: string,
  patch: { email?: string | null; passwordHash?: string },
): Promise<void> {
  await db
    .update(users)
    .set({ ...patch, updatedAt: new Date() })
    .where(eq(users.id, id));
}

// ---------- Importação do localStorage ----------

/**
 * Insere os dados antigos do navegador. Registros cujo id já existe são ignorados,
 * então importar duas vezes não duplica nada. A fatura dos cartões vem pronta do
 * localStorage, por isso as transações entram direto, sem passar por adjustInvoice.
 */
export async function importSnapshot(db: Db, userId: string, data: SnapshotInput): Promise<void> {
  // createdAt sintético para manter a ordem que o store tinha (transações/itens: mais novo primeiro).
  const base = Date.now();
  const newestFirst = (i: number) => new Date(base - i);
  const oldestFirst = (i: number, total: number) => new Date(base - total + i);

  await db.transaction(async (tx) => {
    for (const rows of chunk(
      data.creditCards.map((c, i) => ({
        ...c,
        userId,
        createdAt: oldestFirst(i, data.creditCards.length),
      })),
    )) {
      await tx.insert(creditCards).values(rows).onConflictDoNothing();
    }

    const cardIds = await userCardIds(tx, userId);

    for (const rows of chunk(
      data.transactions.map((t, i) => ({
        ...t,
        userId,
        creditCardId: t.creditCardId && cardIds.has(t.creditCardId) ? t.creditCardId : null,
        createdAt: newestFirst(i),
      })),
    )) {
      await tx.insert(transactions).values(rows).onConflictDoNothing();
    }

    for (const rows of chunk(
      data.savingsGoals.map((g, i) => ({
        ...g,
        userId,
        createdAt: oldestFirst(i, data.savingsGoals.length),
      })),
    )) {
      await tx.insert(savingsGoals).values(rows).onConflictDoNothing();
    }

    for (const rows of chunk(
      data.shoppingItems.map((item, i) => ({
        ...item,
        userId,
        priority: item.priority ?? null,
        createdAt: newestFirst(i),
      })),
    )) {
      await tx.insert(shoppingItems).values(rows).onConflictDoNothing();
    }

    for (const rows of chunk(
      data.debts.map((d, i) => ({ ...d, userId, createdAt: oldestFirst(i, data.debts.length) })),
    )) {
      await tx.insert(debts).values(rows).onConflictDoNothing();
    }

    for (const rows of chunk(
      data.categories.map((c, i) => ({
        ...c,
        userId,
        createdAt: oldestFirst(i, data.categories.length),
      })),
    )) {
      await tx.insert(categories).values(rows).onConflictDoNothing();
    }
  });
}

/** Postgres aceita no máximo 65535 parâmetros por query; 500 linhas × ~12 colunas fica bem abaixo. */
function chunk<T>(items: T[], size = 500): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

export async function checkConnection(db: Db): Promise<void> {
  await db.execute(sql`select 1`);
}
