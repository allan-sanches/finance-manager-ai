import { parseAmount } from '@/lib/import/statement';
import { normalizeCategoryName as normalize } from '@/lib/tones';
import type { BankAccount, CreditCard, SavingsGoal, Transaction } from '@/types/finance';

// Busca do dashboard: um texto livre encontra lançamentos (descrição, categoria, banco, cartão,
// caixinha ou valor) e categorias — inclusive as criadas pelo usuário, como "Pessoas". Sem acento e
// sem maiúsculas: "joao" acha "João".

export const MIN_QUERY_LENGTH = 2;

export type SearchSources = {
  transactions: ReadonlyArray<Transaction>;
  bankAccounts: ReadonlyArray<Pick<BankAccount, 'id' | 'name'>>;
  creditCards: ReadonlyArray<Pick<CreditCard, 'id' | 'name'>>;
  savingsGoals: ReadonlyArray<Pick<SavingsGoal, 'id' | 'name'>>;
};

export type CategoryHit = { name: string; count: number; expense: number; income: number };

export type SearchResults = {
  categories: CategoryHit[];
  /** Mais recentes primeiro. */
  transactions: Transaction[];
  totals: { income: number; expense: number };
};

const EMPTY: SearchResults = { categories: [], transactions: [], totals: { income: 0, expense: 0 } };

/** Todas as palavras da busca precisam aparecer (em qualquer ordem) no texto. */
function matcher(query: string): ((text: string) => boolean) | null {
  const words = normalize(query).split(/\s+/).filter(Boolean);
  if (words.length === 0) return null;
  return (text) => {
    const haystack = normalize(text);
    return words.every((w) => haystack.includes(w));
  };
}

/** "45", "45,90", "R$ 1.200" → valor para comparar com o do lançamento; null se não for número. */
function amountOf(query: string): number | null {
  if (!/^\s*(R\$\s*)?[\d.,]+\s*$/.test(query)) return null;
  const value = parseAmount(query.trim());
  return value !== null && value > 0 ? Math.abs(value) : null;
}

export function searchFinance(query: string, sources: SearchSources): SearchResults {
  if (query.trim().length < MIN_QUERY_LENGTH) return EMPTY;
  const matches = matcher(query);
  if (!matches) return EMPTY;
  const amount = amountOf(query);

  const names = (list: ReadonlyArray<{ id: string; name: string }>) => new Map(list.map((x) => [x.id, x.name]));
  const banks = names(sources.bankAccounts);
  const cards = names(sources.creditCards);
  const goals = names(sources.savingsGoals);

  const transactions = sources.transactions
    .filter((t) => {
      // Valor digitado: acha "45" em 45,00 e "45,9" em 45,90 (centavos exatos quando informados).
      if (amount !== null) {
        const sameValue = /[.,]\d{1,2}\s*$/.test(query) ? t.amount === amount : Math.trunc(t.amount) === amount;
        if (sameValue) return true;
      }
      const text = [
        t.description,
        t.category,
        t.bankAccountId ? banks.get(t.bankAccountId) : '',
        t.creditCardId ? cards.get(t.creditCardId) : '',
        t.savingsGoalId ? goals.get(t.savingsGoalId) : '',
      ].join(' ');
      return matches(text);
    })
    .sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id));

  // Categorias pelo nome, com o total de todos os lançamentos delas (não só dos encontrados).
  const byCategory = new Map<string, CategoryHit>();
  for (const t of sources.transactions) {
    if (!matches(t.category)) continue;
    const key = normalize(t.category);
    const hit = byCategory.get(key) ?? { name: t.category, count: 0, expense: 0, income: 0 };
    hit.count += 1;
    if (!t.isTransfer) {
      if (t.type === 'expense') hit.expense += t.amount;
      else hit.income += t.amount;
    }
    byCategory.set(key, hit);
  }

  const totals = { income: 0, expense: 0 };
  for (const t of transactions) {
    if (t.isTransfer) continue;
    if (t.type === 'income') totals.income += t.amount;
    else totals.expense += t.amount;
  }

  return {
    categories: [...byCategory.values()].sort((a, b) => b.count - a.count),
    transactions,
    totals,
  };
}
