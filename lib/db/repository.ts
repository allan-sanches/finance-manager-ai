import { asc, desc, eq, sql } from 'drizzle-orm';
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core';

import * as schema from '@/lib/db/schema';
import { mergeCategoryNames } from '@/lib/finance';
import type { SnapshotInput } from '@/lib/finance-schemas';
import { normalizeCategoryName } from '@/lib/tones';
import type {
  Category,
  CreditCard,
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

const { categories, creditCards, debts, savingsGoals, shoppingItems, transactions } = schema;

export async function getSnapshot(db: Db): Promise<FinanceSnapshot> {
  const [txRows, cardRows, goalRows, itemRows, debtRows, categoryRows] = await Promise.all([
    db.select().from(transactions).orderBy(desc(transactions.createdAt), desc(transactions.id)),
    db.select().from(creditCards).orderBy(asc(creditCards.createdAt), asc(creditCards.id)),
    db.select().from(savingsGoals).orderBy(asc(savingsGoals.createdAt), asc(savingsGoals.id)),
    db.select().from(shoppingItems).orderBy(desc(shoppingItems.createdAt), desc(shoppingItems.id)),
    db.select().from(debts).orderBy(asc(debts.createdAt), asc(debts.id)),
    db.select().from(categories).orderBy(asc(categories.createdAt), asc(categories.id)),
  ]);

  return {
    transactions: txRows.map(
      ({ createdAt: _, ...t }): Transaction => ({ ...t, creditCardId: t.creditCardId ?? null }),
    ),
    creditCards: cardRows.map(({ createdAt: _, ...c }): CreditCard => c),
    savingsGoals: goalRows.map(({ createdAt: _, ...g }): SavingsGoal => g),
    shoppingItems: itemRows.map(
      ({ createdAt: _, priority, ...i }): ShoppingItem => ({
        ...i,
        ...(priority ? { priority } : {}),
      }),
    ),
    debts: debtRows.map(({ createdAt: _, ...d }): Debt => d),
    categories: categoryRows.map(({ createdAt: _, ...c }): Category => c),
  };
}

// ---------- Transações + fatura do cartão ----------

const invoiceContribution = (t: Pick<Transaction, 'paymentMethod' | 'creditCardId' | 'amount'>) =>
  t.paymentMethod === 'credit_card' && t.creditCardId ? t.amount : 0;

async function adjustInvoice(db: Executor, cardId: string | null | undefined, delta: number) {
  if (!cardId || delta === 0) return;
  await db
    .update(creditCards)
    .set({ currentInvoiceAmount: sql`greatest(0, ${creditCards.currentInvoiceAmount} + ${delta})` })
    .where(eq(creditCards.id, cardId));
}

/** Descarta creditCardId que não existe, em vez de estourar a FK. */
async function existingCardId(db: Executor, cardId: string | null | undefined) {
  if (!cardId) return null;
  const [row] = await db
    .select({ id: creditCards.id })
    .from(creditCards)
    .where(eq(creditCards.id, cardId));
  return row?.id ?? null;
}

export async function addTransaction(db: Db, input: Transaction): Promise<void> {
  await db.transaction(async (tx) => {
    const creditCardId = await existingCardId(tx, input.creditCardId);
    const row = { ...input, creditCardId };
    await tx.insert(transactions).values(row);
    await adjustInvoice(tx, creditCardId, invoiceContribution(row));
  });
}

export async function updateTransaction(
  db: Db,
  id: string,
  patch: Partial<Omit<Transaction, 'id'>>,
): Promise<void> {
  await db.transaction(async (tx) => {
    const [prev] = await tx.select().from(transactions).where(eq(transactions.id, id)).for('update');
    if (!prev) return;
    const next = { ...prev, ...patch, id: prev.id };
    next.creditCardId = await existingCardId(tx, next.creditCardId);

    await tx
      .update(transactions)
      .set({
        description: next.description,
        amount: next.amount,
        type: next.type,
        category: next.category,
        paymentMethod: next.paymentMethod,
        creditCardId: next.creditCardId,
        date: next.date,
        isFixed: next.isFixed,
        isPaid: next.isPaid,
      })
      .where(eq(transactions.id, id));

    if (prev.creditCardId === next.creditCardId) {
      await adjustInvoice(tx, next.creditCardId, invoiceContribution(next) - invoiceContribution(prev));
    } else {
      await adjustInvoice(tx, prev.creditCardId, -invoiceContribution(prev));
      await adjustInvoice(tx, next.creditCardId, invoiceContribution(next));
    }
  });
}

/**
 * Lançamentos de um extrato importado, numa única transação do banco: ou entram todos, ou nenhum.
 * A fatura de cada cartão recebe a soma dos lançamentos no crédito, como no addTransaction.
 */
export async function addTransactions(db: Db, inputs: Transaction[]): Promise<void> {
  // createdAt decrescente para a lista ficar na ordem do arquivo (mais novo primeiro).
  const base = Date.now();
  await db.transaction(async (tx) => {
    const cardIds = new Set(
      (await tx.select({ id: creditCards.id }).from(creditCards)).map((r) => r.id),
    );
    const rows = inputs.map((t, i) => ({
      ...t,
      creditCardId: t.creditCardId && cardIds.has(t.creditCardId) ? t.creditCardId : null,
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
    for (const [cardId, delta] of invoiceDelta) await adjustInvoice(tx, cardId, delta);
  });
}

export async function removeTransaction(db: Db, id: string): Promise<void> {
  await db.transaction(async (tx) => {
    const [prev] = await tx.delete(transactions).where(eq(transactions.id, id)).returning();
    if (prev) await adjustInvoice(tx, prev.creditCardId, -invoiceContribution(prev));
  });
}

export async function toggleTransactionPaid(db: Db, id: string): Promise<void> {
  await db
    .update(transactions)
    .set({ isPaid: sql`not ${transactions.isPaid}` })
    .where(eq(transactions.id, id));
}

// ---------- Cartões ----------

export async function addCreditCard(db: Db, input: CreditCard): Promise<void> {
  await db.insert(creditCards).values(input);
}

export async function updateCreditCard(
  db: Db,
  id: string,
  patch: Partial<Omit<CreditCard, 'id' | 'currentInvoiceAmount'>>,
): Promise<void> {
  if (Object.keys(patch).length === 0) return;
  await db.update(creditCards).set(patch).where(eq(creditCards.id, id));
}

/** A FK com ON DELETE SET NULL desvincula as transações do cartão removido. */
export async function removeCreditCard(db: Db, id: string): Promise<void> {
  await db.delete(creditCards).where(eq(creditCards.id, id));
}

// ---------- Caixinhas ----------

export async function addSavingsGoal(db: Db, input: SavingsGoal): Promise<void> {
  await db.insert(savingsGoals).values(input);
}

export async function depositToGoal(db: Db, id: string, amount: number): Promise<void> {
  await db
    .update(savingsGoals)
    .set({ currentAmount: sql`${savingsGoals.currentAmount} + ${amount}` })
    .where(eq(savingsGoals.id, id));
}

export async function withdrawFromGoal(db: Db, id: string, amount: number): Promise<void> {
  await db
    .update(savingsGoals)
    .set({ currentAmount: sql`greatest(0, ${savingsGoals.currentAmount} - ${amount})` })
    .where(eq(savingsGoals.id, id));
}

export async function updateSavingsGoal(
  db: Db,
  id: string,
  patch: Partial<Omit<SavingsGoal, 'id' | 'currentAmount'>>,
): Promise<void> {
  if (Object.keys(patch).length === 0) return;
  await db.update(savingsGoals).set(patch).where(eq(savingsGoals.id, id));
}

export async function removeSavingsGoal(db: Db, id: string): Promise<void> {
  await db.delete(savingsGoals).where(eq(savingsGoals.id, id));
}

// ---------- Listas ----------

export async function addShoppingItem(db: Db, input: ShoppingItem): Promise<void> {
  await db.insert(shoppingItems).values({ ...input, priority: input.priority ?? null });
}

export async function toggleShoppingItem(db: Db, id: string): Promise<void> {
  await db
    .update(shoppingItems)
    .set({ isPurchased: sql`not ${shoppingItems.isPurchased}` })
    .where(eq(shoppingItems.id, id));
}

export async function updateShoppingItem(
  db: Db,
  id: string,
  patch: Partial<Omit<ShoppingItem, 'id'>>,
): Promise<void> {
  if (Object.keys(patch).length === 0) return;
  await db.update(shoppingItems).set(patch).where(eq(shoppingItems.id, id));
}

export async function removeShoppingItem(db: Db, id: string): Promise<void> {
  await db.delete(shoppingItems).where(eq(shoppingItems.id, id));
}

// ---------- Categorias do usuário ----------

/** Nome repetido (mesmo nome, diferença só de maiúsculas/acentos) é ignorado: a categoria já existe. */
export async function addCategory(db: Db, input: Category): Promise<void> {
  const key = normalizeCategoryName(input.name);
  const existing = await db.select({ name: categories.name }).from(categories);
  if (existing.some((c) => normalizeCategoryName(c.name) === key)) return;
  await db.insert(categories).values(input).onConflictDoNothing();
}

/** Nomes para os prompts da IA: padrão + as do usuário. */
export async function listCategoryNames(db: Db): Promise<string[]> {
  return mergeCategoryNames(await db.select({ name: categories.name }).from(categories));
}

/** Os lançamentos guardam o nome da categoria, então continuam intactos. */
export async function removeCategory(db: Db, id: string): Promise<void> {
  await db.delete(categories).where(eq(categories.id, id));
}

// ---------- Dívidas (Registrato/SCR e Serasa) ----------

/** Um relatório novo é a foto atual: apaga as dívidas daquela origem e grava as do relatório. */
export async function replaceDebts(db: Db, source: DebtSource, inputs: Debt[]): Promise<void> {
  const base = Date.now();
  await db.transaction(async (tx) => {
    await tx.delete(debts).where(eq(debts.source, source));
    const rows = inputs.map((d, i) => ({ ...d, source, createdAt: new Date(base + i) }));
    for (const part of chunk(rows)) {
      await tx.insert(debts).values(part);
    }
  });
}

export async function removeDebt(db: Db, id: string): Promise<void> {
  await db.delete(debts).where(eq(debts.id, id));
}

// ---------- Importação do localStorage ----------

/**
 * Insere os dados antigos do navegador. Registros cujo id já existe são ignorados,
 * então importar duas vezes não duplica nada. A fatura dos cartões vem pronta do
 * localStorage, por isso as transações entram direto, sem passar por adjustInvoice.
 */
export async function importSnapshot(db: Db, data: SnapshotInput): Promise<void> {
  // createdAt sintético para manter a ordem que o store tinha (transações/itens: mais novo primeiro).
  const base = Date.now();
  const newestFirst = (i: number) => new Date(base - i);
  const oldestFirst = (i: number, total: number) => new Date(base - total + i);

  await db.transaction(async (tx) => {
    for (const rows of chunk(
      data.creditCards.map((c, i) => ({ ...c, createdAt: oldestFirst(i, data.creditCards.length) })),
    )) {
      await tx.insert(creditCards).values(rows).onConflictDoNothing();
    }

    const cardIds = new Set(
      (await tx.select({ id: creditCards.id }).from(creditCards)).map((r) => r.id),
    );

    for (const rows of chunk(
      data.transactions.map((t, i) => ({
        ...t,
        creditCardId: t.creditCardId && cardIds.has(t.creditCardId) ? t.creditCardId : null,
        createdAt: newestFirst(i),
      })),
    )) {
      await tx.insert(transactions).values(rows).onConflictDoNothing();
    }

    for (const rows of chunk(
      data.savingsGoals.map((g, i) => ({ ...g, createdAt: oldestFirst(i, data.savingsGoals.length) })),
    )) {
      await tx.insert(savingsGoals).values(rows).onConflictDoNothing();
    }

    for (const rows of chunk(
      data.shoppingItems.map((item, i) => ({
        ...item,
        priority: item.priority ?? null,
        createdAt: newestFirst(i),
      })),
    )) {
      await tx.insert(shoppingItems).values(rows).onConflictDoNothing();
    }

    for (const rows of chunk(
      data.debts.map((d, i) => ({ ...d, createdAt: oldestFirst(i, data.debts.length) })),
    )) {
      await tx.insert(debts).values(rows).onConflictDoNothing();
    }

    for (const rows of chunk(
      data.categories.map((c, i) => ({ ...c, createdAt: oldestFirst(i, data.categories.length) })),
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
