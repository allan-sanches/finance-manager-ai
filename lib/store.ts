'use client';

import { create } from 'zustand';

import * as actions from '@/app/actions/finance';
import { DEFAULT_SETTINGS, todayISO } from '@/lib/finance';
import type {
  AppSettings,
  Category,
  CreditCard,
  Debt,
  DebtEntry,
  DebtSource,
  FinanceSnapshot,
  SavingsGoal,
  ShoppingItem,
  Transaction,
  TransactionDraft,
} from '@/types/finance';

type FinanceState = FinanceSnapshot & {
  hydrated: boolean;
  syncError: string | null;

  hydrate: (snapshot: FinanceSnapshot) => void;
  dismissSyncError: () => void;

  // Transactions
  addTransaction: (draft: TransactionDraft) => Transaction;
  updateTransaction: (id: string, patch: Partial<Omit<Transaction, 'id'>>) => void;
  removeTransaction: (id: string) => void;
  toggleTransactionPaid: (id: string) => void;
  importTransactions: (drafts: ReadonlyArray<TransactionDraft>) => void;

  // Debts
  replaceDebts: (source: DebtSource, entries: ReadonlyArray<DebtEntry>) => void;
  removeDebt: (id: string) => void;
  addDebt: (draft: Omit<Debt, 'id' | 'source'>) => Debt;
  updateDebt: (id: string, patch: Partial<Omit<Debt, 'id' | 'source'>>) => void;

  // Settings
  updateSettings: (patch: Partial<AppSettings>) => void;

  // Categories
  addCategory: (draft: Omit<Category, 'id'>) => Category;
  removeCategory: (id: string) => void;

  // Credit cards
  addCreditCard: (draft: Omit<CreditCard, 'id'>) => CreditCard;
  updateCreditCard: (id: string, patch: Partial<Omit<CreditCard, 'id'>>) => void;
  removeCreditCard: (id: string) => void;

  // Savings goals
  addSavingsGoal: (draft: Omit<SavingsGoal, 'id' | 'currentAmount'>) => SavingsGoal;
  /** Em caixinha com prazo de resgate, o depósito também marca a data (hoje) para o resgate provável. */
  depositToGoal: (id: string, amount: number) => void;
  withdrawFromGoal: (id: string, amount: number) => void;
  updateSavingsGoal: (id: string, patch: Partial<Omit<SavingsGoal, 'id'>>) => void;
  removeSavingsGoal: (id: string) => void;

  // Shopping items
  addShoppingItem: (draft: Omit<ShoppingItem, 'id' | 'isPurchased'>) => ShoppingItem;
  toggleShoppingItem: (id: string) => void;
  updateShoppingItem: (id: string, patch: Partial<Omit<ShoppingItem, 'id'>>) => void;
  removeShoppingItem: (id: string) => void;
};

type SetState = (fn: (s: FinanceState) => Partial<FinanceState>) => void;

const newId = (): string =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `id-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

const initialState: FinanceSnapshot = {
  transactions: [],
  creditCards: [],
  savingsGoals: [],
  shoppingItems: [],
  debts: [],
  categories: [],
  settings: DEFAULT_SETTINGS,
};

const transactionFromDraft = (draft: TransactionDraft): Transaction => ({
  id: newId(),
  description: draft.description,
  amount: draft.amount,
  type: draft.type,
  category: draft.category,
  paymentMethod: draft.paymentMethod,
  creditCardId: draft.creditCardId ?? null,
  date: draft.date,
  isFixed: draft.isFixed,
  isPaid: draft.isPaid ?? false,
});

// Mutações são aplicadas na hora (otimista) e enviadas ao servidor em fila, na ordem.
// Só o snapshot da última mutação pendente é aplicado, para uma resposta antiga
// não sobrescrever uma mudança local mais nova.
let queue: Promise<unknown> = Promise.resolve();
let pending = 0;

export const useFinanceStore = create<FinanceState>()((set, get) => {
  function sync(request: () => Promise<FinanceSnapshot>) {
    pending += 1;
    queue = queue
      .then(request)
      .then((snapshot) => {
        pending -= 1;
        if (pending === 0) set({ ...snapshot });
      })
      .catch(async (err: unknown) => {
        pending -= 1;
        console.error('[store] sync failed', err);
        set({ syncError: 'Não foi possível salvar a última alteração. Os dados foram recarregados do servidor.' });
        try {
          const snapshot = await actions.loadSnapshot();
          if (pending === 0) set({ ...snapshot });
        } catch {
          // Sem conexão: mantém o estado local e o aviso na tela.
        }
      });
  }

  return {
    ...initialState,
    hydrated: false,
    syncError: null,

    hydrate: (snapshot) => set({ ...snapshot, hydrated: true }),
    dismissSyncError: () => set({ syncError: null }),

    addTransaction: (draft) => {
      const tx = transactionFromDraft(draft);
      set((s) => ({ transactions: [tx, ...s.transactions] }));
      if (tx.paymentMethod === 'credit_card' && tx.creditCardId) {
        set((s) => ({
          creditCards: s.creditCards.map((card) =>
            card.id === tx.creditCardId
              ? { ...card, currentInvoiceAmount: card.currentInvoiceAmount + tx.amount }
              : card,
          ),
        }));
      }
      sync(() => actions.addTransaction(tx));
      return tx;
    },

    updateTransaction: (id, patch) => {
      const prev = get().transactions.find((t) => t.id === id);
      if (!prev) return;
      const next: Transaction = { ...prev, ...patch, id: prev.id };
      set((s) => ({
        transactions: s.transactions.map((t) => (t.id === id ? next : t)),
      }));
      adjustInvoiceOnTxChange(prev, next, set);
      sync(() => actions.updateTransaction(id, patch));
    },

    removeTransaction: (id) => {
      const prev = get().transactions.find((t) => t.id === id);
      if (!prev) return;
      set((s) => ({ transactions: s.transactions.filter((t) => t.id !== id) }));
      if (prev.paymentMethod === 'credit_card' && prev.creditCardId) {
        set((s) => ({
          creditCards: s.creditCards.map((c) =>
            c.id === prev.creditCardId
              ? {
                  ...c,
                  currentInvoiceAmount: Math.max(0, c.currentInvoiceAmount - prev.amount),
                }
              : c,
          ),
        }));
      }
      sync(() => actions.removeTransaction(id));
    },

    toggleTransactionPaid: (id) => {
      set((s) => ({
        transactions: s.transactions.map((t) =>
          t.id === id ? { ...t, isPaid: !t.isPaid } : t,
        ),
      }));
      sync(() => actions.toggleTransactionPaid(id));
    },

    importTransactions: (drafts) => {
      if (drafts.length === 0) return;
      const txs = drafts.map(transactionFromDraft);
      const invoiceDelta = new Map<string, number>();
      for (const tx of txs) {
        if (tx.paymentMethod !== 'credit_card' || !tx.creditCardId) continue;
        invoiceDelta.set(tx.creditCardId, (invoiceDelta.get(tx.creditCardId) ?? 0) + tx.amount);
      }
      set((s) => ({
        transactions: [...txs, ...s.transactions],
        creditCards: s.creditCards.map((card) => {
          const delta = invoiceDelta.get(card.id);
          return delta ? { ...card, currentInvoiceAmount: card.currentInvoiceAmount + delta } : card;
        }),
      }));
      sync(() => actions.importTransactions(txs));
    },

    replaceDebts: (source, entries) => {
      const next: Debt[] = entries.map((e) => ({ ...e, id: newId(), source, status: 'active', notes: null }));
      set((s) => ({ debts: [...s.debts.filter((d) => d.source !== source), ...next] }));
      sync(() => actions.replaceDebts(source, next));
    },

    removeDebt: (id) => {
      set((s) => ({ debts: s.debts.filter((d) => d.id !== id) }));
      sync(() => actions.removeDebt(id));
    },

    addDebt: (draft) => {
      const debt: Debt = { ...draft, id: newId(), source: 'manual', notes: draft.notes ?? null };
      set((s) => ({ debts: [...s.debts, debt] }));
      sync(() => actions.addDebt(debt));
      return debt;
    },

    updateDebt: (id, patch) => {
      set((s) => ({ debts: s.debts.map((d) => (d.id === id ? { ...d, ...patch, id } : d)) }));
      sync(() => actions.updateDebt(id, patch));
    },

    updateSettings: (patch) => {
      set((s) => ({ settings: { ...s.settings, ...patch } }));
      sync(() => actions.updateSettings(patch));
    },

    addCategory: (draft) => {
      const category: Category = { id: newId(), ...draft, name: draft.name.trim() };
      set((s) => ({ categories: [...s.categories, category] }));
      sync(() => actions.addCategory(category));
      return category;
    },

    removeCategory: (id) => {
      set((s) => ({ categories: s.categories.filter((c) => c.id !== id) }));
      sync(() => actions.removeCategory(id));
    },

    addCreditCard: (draft) => {
      const card: CreditCard = { id: newId(), ...draft };
      set((s) => ({ creditCards: [...s.creditCards, card] }));
      sync(() => actions.addCreditCard(card));
      return card;
    },

    updateCreditCard: (id, patch) => {
      set((s) => ({
        creditCards: s.creditCards.map((c) => (c.id === id ? { ...c, ...patch, id } : c)),
      }));
      // currentInvoiceAmount é mantido pelo servidor a partir das transações.
      const { currentInvoiceAmount: _, ...serverPatch } = patch;
      sync(() => actions.updateCreditCard(id, serverPatch));
    },

    removeCreditCard: (id) => {
      set((s) => ({
        creditCards: s.creditCards.filter((c) => c.id !== id),
        transactions: s.transactions.map((t) =>
          t.creditCardId === id ? { ...t, creditCardId: null } : t,
        ),
      }));
      sync(() => actions.removeCreditCard(id));
    },

    addSavingsGoal: (draft) => {
      const goal: SavingsGoal = {
        id: newId(),
        name: draft.name,
        targetAmount: draft.targetAmount,
        deadline: draft.deadline ?? null,
        institution: draft.institution ?? null,
        cdiPercent: draft.cdiPercent ?? null,
        currency: draft.currency,
        lockDays: draft.lockDays ?? null,
        depositDate: draft.depositDate ?? null,
        currentAmount: 0,
      };
      set((s) => ({ savingsGoals: [...s.savingsGoals, goal] }));
      sync(() => actions.addSavingsGoal(goal));
      return goal;
    },

    depositToGoal: (id, amount) => {
      if (!Number.isFinite(amount) || amount <= 0) return;
      const goal = get().savingsGoals.find((g) => g.id === id);
      const depositDate = goal?.lockDays ? todayISO() : undefined;
      set((s) => ({
        savingsGoals: s.savingsGoals.map((g) =>
          g.id === id
            ? { ...g, currentAmount: g.currentAmount + amount, ...(depositDate ? { depositDate } : {}) }
            : g,
        ),
      }));
      sync(() => actions.depositToGoal(id, amount, depositDate));
    },

    withdrawFromGoal: (id, amount) => {
      if (!Number.isFinite(amount) || amount <= 0) return;
      set((s) => ({
        savingsGoals: s.savingsGoals.map((g) =>
          g.id === id
            ? { ...g, currentAmount: Math.max(0, g.currentAmount - amount) }
            : g,
        ),
      }));
      sync(() => actions.withdrawFromGoal(id, amount));
    },

    updateSavingsGoal: (id, patch) => {
      set((s) => ({
        savingsGoals: s.savingsGoals.map((g) => (g.id === id ? { ...g, ...patch, id } : g)),
      }));
      // currentAmount só muda por depósito/retirada.
      const { currentAmount: _, ...serverPatch } = patch;
      sync(() => actions.updateSavingsGoal(id, serverPatch));
    },

    removeSavingsGoal: (id) => {
      set((s) => ({ savingsGoals: s.savingsGoals.filter((g) => g.id !== id) }));
      sync(() => actions.removeSavingsGoal(id));
    },

    addShoppingItem: (draft) => {
      const item: ShoppingItem = {
        id: newId(),
        name: draft.name,
        listType: draft.listType,
        estimatedPrice: draft.estimatedPrice ?? null,
        priority: draft.priority,
        isPurchased: false,
      };
      set((s) => ({ shoppingItems: [item, ...s.shoppingItems] }));
      sync(() => actions.addShoppingItem(item));
      return item;
    },

    toggleShoppingItem: (id) => {
      set((s) => ({
        shoppingItems: s.shoppingItems.map((i) =>
          i.id === id ? { ...i, isPurchased: !i.isPurchased } : i,
        ),
      }));
      sync(() => actions.toggleShoppingItem(id));
    },

    updateShoppingItem: (id, patch) => {
      set((s) => ({
        shoppingItems: s.shoppingItems.map((i) => (i.id === id ? { ...i, ...patch, id } : i)),
      }));
      sync(() => actions.updateShoppingItem(id, patch));
    },

    removeShoppingItem: (id) => {
      set((s) => ({ shoppingItems: s.shoppingItems.filter((i) => i.id !== id) }));
      sync(() => actions.removeShoppingItem(id));
    },
  };
});

function adjustInvoiceOnTxChange(prev: Transaction, next: Transaction, set: SetState) {
  const prevContrib =
    prev.paymentMethod === 'credit_card' && prev.creditCardId ? prev.amount : 0;
  const nextContrib =
    next.paymentMethod === 'credit_card' && next.creditCardId ? next.amount : 0;

  if (prevContrib === 0 && nextContrib === 0) return;

  set((s) => ({
    creditCards: s.creditCards.map((card) => {
      let delta = 0;
      if (prev.creditCardId === card.id) delta -= prevContrib;
      if (next.creditCardId === card.id) delta += nextContrib;
      if (delta === 0) return card;
      return {
        ...card,
        currentInvoiceAmount: Math.max(0, card.currentInvoiceAmount + delta),
      };
    }),
  }));
}
