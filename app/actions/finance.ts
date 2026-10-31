'use server';

import { requireUserId } from '@/lib/auth';
import { getDb } from '@/lib/db';
import * as repo from '@/lib/db/repository';
import { CATEGORIES } from '@/lib/finance';
import {
  amountSchema,
  bankAccountPatchSchema,
  bankAccountSchema,
  categorySchema,
  creditCardInvoicePatchSchema,
  creditCardInvoiceSchema,
  creditCardPatchSchema,
  creditCardSchema,
  debtBatchSchema,
  debtPatchSchema,
  debtSchema,
  debtSourceSchema,
  idSchema,
  isoDateSchema,
  savingsGoalPatchSchema,
  savingsGoalSchema,
  settingsPatchSchema,
  shoppingItemPatchSchema,
  shoppingItemSchema,
  snapshotSchema,
  transactionBatchSchema,
  transactionPatchSchema,
  transactionSchema,
} from '@/lib/finance-schemas';
import { assertFetchableUrl, fetchProductInfo, ProductFetchError } from '@/lib/product-fetch';
import type { ProductInfo } from '@/lib/product-page';
import { checkWishPrices, PRICE_CHECK_INTERVAL_MS } from '@/lib/price-watch';
import { createRateLimiter } from '@/lib/rate-limit';
import { normalizeCategoryName } from '@/lib/tones';
import type { FinanceSnapshot } from '@/types/finance';

// Cada action devolve o snapshot completo: o store do cliente troca o estado otimista
// pelo que o banco tem, então regras como o saldo da fatura ficam com o servidor.
//
// `actor` é o usuário que a aba acredita estar usando. O cookie de sessão é do navegador inteiro:
// se alguém sair e entrar com outra conta em outra aba, uma aba antiga mandaria as alterações da
// pessoa anterior com o cookie da nova. Nesse caso nada é gravado e o cliente recarrega a tela.

/** A sessão mudou desde que a aba carregou os dados; nada foi gravado. */
export type SessionChanged = { sessionChanged: true };

async function run(
  actor: unknown,
  mutation: (db: repo.Db, userId: string) => Promise<void>,
): Promise<FinanceSnapshot | SessionChanged> {
  const userId = await requireUserId();
  if (actor !== userId) return { sessionChanged: true };
  const db = getDb();
  await mutation(db, userId);
  return repo.getSnapshot(db, userId);
}

export async function loadSnapshot(actor: unknown) {
  return run(actor, async () => {});
}

export async function addTransaction(actor: unknown, input: unknown) {
  const data = transactionSchema.parse(input);
  return run(actor, (db, userId) => repo.addTransaction(db, userId, data));
}

export async function updateTransaction(actor: unknown, id: unknown, patch: unknown) {
  const txId = idSchema.parse(id);
  const data = transactionPatchSchema.parse(patch);
  return run(actor, (db, userId) => repo.updateTransaction(db, userId, txId, data));
}

export async function importTransactions(actor: unknown, input: unknown) {
  const data = transactionBatchSchema.parse(input);
  return run(actor, (db, userId) => repo.addTransactions(db, userId, data));
}

export async function replaceDebts(actor: unknown, source: unknown, input: unknown) {
  const debtSource = debtSourceSchema.parse(source);
  const data = debtBatchSchema.parse(input).map((d) => ({ ...d, source: debtSource }));
  return run(actor, (db, userId) => repo.replaceDebts(db, userId, debtSource, data));
}

export async function removeDebt(actor: unknown, id: unknown) {
  const debtId = idSchema.parse(id);
  return run(actor, (db, userId) => repo.removeDebt(db, userId, debtId));
}

/** Só dívidas manuais nascem pelo app; as de relatório chegam por replaceDebts. */
export async function addDebt(actor: unknown, input: unknown) {
  const data = debtSchema.parse(input);
  return run(actor, (db, userId) => repo.addDebt(db, userId, { ...data, source: 'manual' }));
}

export async function updateDebt(actor: unknown, id: unknown, patch: unknown) {
  const debtId = idSchema.parse(id);
  const data = debtPatchSchema.parse(patch);
  return run(actor, (db, userId) => repo.updateDebt(db, userId, debtId, data));
}

export async function updateSettings(actor: unknown, patch: unknown) {
  const data = settingsPatchSchema.parse(patch);
  return run(actor, (db, userId) => repo.updateSettings(db, userId, data));
}

export async function addCategory(actor: unknown, input: unknown) {
  const data = categorySchema.parse(input);
  const key = normalizeCategoryName(data.name);
  // Mesmo nome de uma categoria padrão: não duplica.
  if (CATEGORIES.some((c) => normalizeCategoryName(c) === key)) return run(actor, async () => {});
  return run(actor, (db, userId) => repo.addCategory(db, userId, data));
}

export async function removeCategory(actor: unknown, id: unknown) {
  const categoryId = idSchema.parse(id);
  return run(actor, (db, userId) => repo.removeCategory(db, userId, categoryId));
}

export async function removeTransaction(actor: unknown, id: unknown) {
  const txId = idSchema.parse(id);
  return run(actor, (db, userId) => repo.removeTransaction(db, userId, txId));
}

export async function toggleTransactionPaid(actor: unknown, id: unknown) {
  const txId = idSchema.parse(id);
  return run(actor, (db, userId) => repo.toggleTransactionPaid(db, userId, txId));
}

export async function addCreditCard(actor: unknown, input: unknown) {
  const data = creditCardSchema.parse(input);
  return run(actor, (db, userId) => repo.addCreditCard(db, userId, data));
}

export async function updateCreditCard(actor: unknown, id: unknown, patch: unknown) {
  const cardId = idSchema.parse(id);
  const data = creditCardPatchSchema.parse(patch);
  return run(actor, (db, userId) => repo.updateCreditCard(db, userId, cardId, data));
}

export async function removeCreditCard(actor: unknown, id: unknown) {
  const cardId = idSchema.parse(id);
  return run(actor, (db, userId) => repo.removeCreditCard(db, userId, cardId));
}

export async function addCreditCardInvoice(actor: unknown, input: unknown) {
  const data = creditCardInvoiceSchema.parse(input);
  return run(actor, (db, userId) => repo.addCreditCardInvoice(db, userId, data));
}

export async function updateCreditCardInvoice(actor: unknown, id: unknown, patch: unknown) {
  const invoiceId = idSchema.parse(id);
  const data = creditCardInvoicePatchSchema.parse(patch);
  return run(actor, (db, userId) => repo.updateCreditCardInvoice(db, userId, invoiceId, data));
}

export async function removeCreditCardInvoice(actor: unknown, id: unknown) {
  const invoiceId = idSchema.parse(id);
  return run(actor, (db, userId) => repo.removeCreditCardInvoice(db, userId, invoiceId));
}

export async function addBankAccount(actor: unknown, input: unknown) {
  const data = bankAccountSchema.parse(input);
  return run(actor, (db, userId) => repo.addBankAccount(db, userId, data));
}

export async function updateBankAccount(actor: unknown, id: unknown, patch: unknown) {
  const accountId = idSchema.parse(id);
  const data = bankAccountPatchSchema.parse(patch);
  return run(actor, (db, userId) => repo.updateBankAccount(db, userId, accountId, data));
}

export async function removeBankAccount(actor: unknown, id: unknown) {
  const accountId = idSchema.parse(id);
  return run(actor, (db, userId) => repo.removeBankAccount(db, userId, accountId));
}

export async function addSavingsGoal(actor: unknown, input: unknown) {
  const data = savingsGoalSchema.parse(input);
  return run(actor, (db, userId) => repo.addSavingsGoal(db, userId, data));
}

export async function depositToGoal(actor: unknown, id: unknown, amount: unknown, depositDate?: unknown) {
  const goalId = idSchema.parse(id);
  const value = amountSchema.parse(amount);
  const date = isoDateSchema.optional().parse(depositDate);
  return run(actor, (db, userId) => repo.depositToGoal(db, userId, goalId, value, date));
}

export async function withdrawFromGoal(actor: unknown, id: unknown, amount: unknown) {
  const goalId = idSchema.parse(id);
  const value = amountSchema.parse(amount);
  return run(actor, (db, userId) => repo.withdrawFromGoal(db, userId, goalId, value));
}

export async function updateSavingsGoal(actor: unknown, id: unknown, patch: unknown) {
  const goalId = idSchema.parse(id);
  const data = savingsGoalPatchSchema.parse(patch);
  return run(actor, (db, userId) => repo.updateSavingsGoal(db, userId, goalId, data));
}

export async function removeSavingsGoal(actor: unknown, id: unknown) {
  const goalId = idSchema.parse(id);
  return run(actor, (db, userId) => repo.removeSavingsGoal(db, userId, goalId));
}

export async function addShoppingItem(actor: unknown, input: unknown) {
  const data = shoppingItemSchema.parse(input);
  return run(actor, (db, userId) => repo.addShoppingItem(db, userId, data));
}

export async function toggleShoppingItem(actor: unknown, id: unknown) {
  const itemId = idSchema.parse(id);
  return run(actor, (db, userId) => repo.toggleShoppingItem(db, userId, itemId));
}

export async function updateShoppingItem(actor: unknown, id: unknown, patch: unknown) {
  const itemId = idSchema.parse(id);
  const data = shoppingItemPatchSchema.parse(patch);
  return run(actor, (db, userId) => repo.updateShoppingItem(db, userId, itemId, data));
}

export async function removeShoppingItem(actor: unknown, id: unknown) {
  const itemId = idSchema.parse(id);
  return run(actor, (db, userId) => repo.removeShoppingItem(db, userId, itemId));
}

// ---------- Preço automático da lista de desejos ----------
// Cada leitura abre uma página de loja pelo servidor: limita por conta para ninguém usar o app
// como robô de requisições.
const checkLookupRate = createRateLimiter({ limit: 20, windowMs: 60_000 });
const checkForcedRefreshRate = createRateLimiter({ limit: 30, windowMs: 60 * 60_000 });

export type LookupResult = { ok: true; info: ProductInfo } | { ok: false; error: string };

/** Formulário do desejo: lê nome, preço e foto do link antes de salvar. */
export async function lookupProduct(url: unknown): Promise<LookupResult> {
  const userId = await requireUserId();
  if (typeof url !== 'string' || url.length > 2000) return { ok: false, error: 'Link inválido.' };
  if (!checkLookupRate(userId).allowed) return { ok: false, error: 'Muitas consultas seguidas. Espere um minuto.' };
  try {
    assertFetchableUrl(url.trim());
    const info = await fetchProductInfo(url.trim());
    // Sem preço quase sempre é página de bloqueio anti-robô; o nome dela ("Mercado Libre") não serve.
    if (info.price === null) {
      return { ok: false, error: 'Não achei o preço nessa página (a loja pode bloquear consultas automáticas).' };
    }
    return { ok: true, info };
  } catch (err) {
    return { ok: false, error: err instanceof ProductFetchError ? err.message : 'Não foi possível abrir o link.' };
  }
}

export type RefreshResult = { checked: number; updated: number; limited?: boolean };

/**
 * Lê de novo o preço na loja. Sem `id`: os desejos da conta sem leitura nas últimas 6h (a página
 * chama ao abrir). Com `id`: aquele desejo, na hora. Não passa pelo `run` para não devolver o
 * snapshot: o cliente recarrega pela fila dele depois.
 */
export async function refreshWishPrices(actor: unknown, id?: unknown): Promise<RefreshResult | SessionChanged> {
  const userId = await requireUserId();
  if (actor !== userId) return { sessionChanged: true };
  const itemId = id === undefined ? undefined : idSchema.parse(id);
  if (itemId && !checkForcedRefreshRate(userId).allowed) return { checked: 0, updated: 0, limited: true };
  const db = getDb();
  const wishes = await repo.listWishesToCheck(db, {
    userId,
    ids: itemId ? [itemId] : undefined,
    staleBefore: itemId ? new Date() : new Date(Date.now() - PRICE_CHECK_INTERVAL_MS),
    limit: 30,
  });
  const updated = await checkWishPrices(db, wishes);
  return { checked: wishes.length, updated };
}

/**
 * Dados do localStorage da época de usuário único: são da conta original. Outra pessoa logada no
 * mesmo navegador não pode puxá-los para a conta dela.
 */
export async function importLocalData(actor: unknown, input: unknown) {
  const data = snapshotSchema.parse(input);
  return run(actor, async (db, userId) => {
    if (userId !== repo.OWNER_ID) return;
    await repo.importSnapshot(db, userId, data);
  });
}
