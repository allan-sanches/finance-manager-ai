'use server';

import { requireSession } from '@/lib/auth';
import { getDb } from '@/lib/db';
import * as repo from '@/lib/db/repository';
import { CATEGORIES } from '@/lib/finance';
import {
  amountSchema,
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
import { normalizeCategoryName } from '@/lib/tones';
import type { FinanceSnapshot } from '@/types/finance';

// Cada action devolve o snapshot completo: o store do cliente troca o estado otimista
// pelo que o banco tem, então regras como o saldo da fatura ficam com o servidor.

async function run(mutation: (db: repo.Db) => Promise<void>): Promise<FinanceSnapshot> {
  await requireSession();
  const db = getDb();
  await mutation(db);
  return repo.getSnapshot(db);
}

export async function loadSnapshot() {
  return run(async () => {});
}

export async function addTransaction(input: unknown) {
  const data = transactionSchema.parse(input);
  return run((db) => repo.addTransaction(db, data));
}

export async function updateTransaction(id: unknown, patch: unknown) {
  const txId = idSchema.parse(id);
  const data = transactionPatchSchema.parse(patch);
  return run((db) => repo.updateTransaction(db, txId, data));
}

export async function importTransactions(input: unknown) {
  const data = transactionBatchSchema.parse(input);
  return run((db) => repo.addTransactions(db, data));
}

export async function replaceDebts(source: unknown, input: unknown) {
  const debtSource = debtSourceSchema.parse(source);
  const data = debtBatchSchema.parse(input).map((d) => ({ ...d, source: debtSource }));
  return run((db) => repo.replaceDebts(db, debtSource, data));
}

export async function removeDebt(id: unknown) {
  const debtId = idSchema.parse(id);
  return run((db) => repo.removeDebt(db, debtId));
}

/** Só dívidas manuais nascem pelo app; as de relatório chegam por replaceDebts. */
export async function addDebt(input: unknown) {
  const data = debtSchema.parse(input);
  return run((db) => repo.addDebt(db, { ...data, source: 'manual' }));
}

export async function updateDebt(id: unknown, patch: unknown) {
  const debtId = idSchema.parse(id);
  const data = debtPatchSchema.parse(patch);
  return run((db) => repo.updateDebt(db, debtId, data));
}

export async function updateSettings(patch: unknown) {
  const data = settingsPatchSchema.parse(patch);
  return run((db) => repo.updateSettings(db, data));
}

export async function addCategory(input: unknown) {
  const data = categorySchema.parse(input);
  const key = normalizeCategoryName(data.name);
  // Mesmo nome de uma categoria padrão: não duplica.
  if (CATEGORIES.some((c) => normalizeCategoryName(c) === key)) return run(async () => {});
  return run((db) => repo.addCategory(db, data));
}

export async function removeCategory(id: unknown) {
  const categoryId = idSchema.parse(id);
  return run((db) => repo.removeCategory(db, categoryId));
}

export async function removeTransaction(id: unknown) {
  const txId = idSchema.parse(id);
  return run((db) => repo.removeTransaction(db, txId));
}

export async function toggleTransactionPaid(id: unknown) {
  const txId = idSchema.parse(id);
  return run((db) => repo.toggleTransactionPaid(db, txId));
}

export async function addCreditCard(input: unknown) {
  const data = creditCardSchema.parse(input);
  return run((db) => repo.addCreditCard(db, data));
}

export async function updateCreditCard(id: unknown, patch: unknown) {
  const cardId = idSchema.parse(id);
  const data = creditCardPatchSchema.parse(patch);
  return run((db) => repo.updateCreditCard(db, cardId, data));
}

export async function removeCreditCard(id: unknown) {
  const cardId = idSchema.parse(id);
  return run((db) => repo.removeCreditCard(db, cardId));
}

export async function addCreditCardInvoice(input: unknown) {
  const data = creditCardInvoiceSchema.parse(input);
  return run((db) => repo.addCreditCardInvoice(db, data));
}

export async function updateCreditCardInvoice(id: unknown, patch: unknown) {
  const invoiceId = idSchema.parse(id);
  const data = creditCardInvoicePatchSchema.parse(patch);
  return run((db) => repo.updateCreditCardInvoice(db, invoiceId, data));
}

export async function removeCreditCardInvoice(id: unknown) {
  const invoiceId = idSchema.parse(id);
  return run((db) => repo.removeCreditCardInvoice(db, invoiceId));
}

export async function addSavingsGoal(input: unknown) {
  const data = savingsGoalSchema.parse(input);
  return run((db) => repo.addSavingsGoal(db, data));
}

export async function depositToGoal(id: unknown, amount: unknown, depositDate?: unknown) {
  const goalId = idSchema.parse(id);
  const value = amountSchema.parse(amount);
  const date = isoDateSchema.optional().parse(depositDate);
  return run((db) => repo.depositToGoal(db, goalId, value, date));
}

export async function withdrawFromGoal(id: unknown, amount: unknown) {
  const goalId = idSchema.parse(id);
  const value = amountSchema.parse(amount);
  return run((db) => repo.withdrawFromGoal(db, goalId, value));
}

export async function updateSavingsGoal(id: unknown, patch: unknown) {
  const goalId = idSchema.parse(id);
  const data = savingsGoalPatchSchema.parse(patch);
  return run((db) => repo.updateSavingsGoal(db, goalId, data));
}

export async function removeSavingsGoal(id: unknown) {
  const goalId = idSchema.parse(id);
  return run((db) => repo.removeSavingsGoal(db, goalId));
}

export async function addShoppingItem(input: unknown) {
  const data = shoppingItemSchema.parse(input);
  return run((db) => repo.addShoppingItem(db, data));
}

export async function toggleShoppingItem(id: unknown) {
  const itemId = idSchema.parse(id);
  return run((db) => repo.toggleShoppingItem(db, itemId));
}

export async function updateShoppingItem(id: unknown, patch: unknown) {
  const itemId = idSchema.parse(id);
  const data = shoppingItemPatchSchema.parse(patch);
  return run((db) => repo.updateShoppingItem(db, itemId, data));
}

export async function removeShoppingItem(id: unknown) {
  const itemId = idSchema.parse(id);
  return run((db) => repo.removeShoppingItem(db, itemId));
}

export async function importLocalData(input: unknown) {
  const data = snapshotSchema.parse(input);
  return run((db) => repo.importSnapshot(db, data));
}
