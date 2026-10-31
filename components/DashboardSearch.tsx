'use client';

import { Search, X } from 'lucide-react';
import { useDeferredValue, useMemo, useState } from 'react';

import { CategoryAvatar } from '@/components/CategoryAvatar';
import { TransactionFormDialog } from '@/components/TransactionFormDialog';
import { BRL, shortDate } from '@/lib/finance';
import { MIN_QUERY_LENGTH, searchFinance } from '@/lib/search';
import { useFinanceStore } from '@/lib/store';
import { normalizeCategoryName } from '@/lib/tones';
import { useVisibleTransactions } from '@/lib/useVisibleTransactions';
import type { Transaction } from '@/types/finance';

const MAX_ROWS = 30;

/** Busca do dashboard: lançamentos e categorias (como "Pessoas"), enquanto digita. */
export function DashboardSearch() {
  const transactions = useVisibleTransactions();
  const bankAccounts = useFinanceStore((s) => s.bankAccounts);
  const creditCards = useFinanceStore((s) => s.creditCards);
  const savingsGoals = useFinanceStore((s) => s.savingsGoals);

  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('');
  const [editing, setEditing] = useState<Transaction | undefined>(undefined);
  // Com milhares de lançamentos, filtrar a cada tecla não pode travar a digitação.
  const deferred = useDeferredValue(query);

  const results = useMemo(
    () => searchFinance(deferred, { transactions, bankAccounts, creditCards, savingsGoals }),
    [deferred, transactions, bankAccounts, creditCards, savingsGoals],
  );

  // Tocar numa categoria encontrada deixa só os lançamentos dela.
  const shown = category
    ? results.transactions.filter((t) => normalizeCategoryName(t.category) === normalizeCategoryName(category))
    : results.transactions;
  const active = deferred.trim().length >= MIN_QUERY_LENGTH;
  const empty = active && results.transactions.length === 0;

  function changeQuery(value: string) {
    setQuery(value);
    setCategory('');
  }

  return (
    <section aria-label="Buscar" className="flex flex-col gap-3">
      <label className="input input-bordered input-lg w-full rounded-box">
        <Search className="text-base-content/50 h-5 w-5" aria-hidden />
        <input
          type="search"
          className="grow text-base"
          placeholder="Buscar transação, pessoa ou categoria"
          aria-label="Buscar transação, pessoa ou categoria"
          value={query}
          onChange={(e) => changeQuery(e.target.value)}
          onKeyDown={(e) => e.key === 'Escape' && changeQuery('')}
          autoComplete="off"
          enterKeyHint="search"
        />
        {query && (
          <button
            type="button"
            className="btn btn-ghost btn-sm btn-circle min-h-11 min-w-11"
            aria-label="Limpar busca"
            onClick={() => changeQuery('')}
          >
            <X className="h-5 w-5" aria-hidden />
          </button>
        )}
      </label>

      {active && (
        <div className="panel flex flex-col gap-4 p-4" role="region" aria-live="polite" aria-label="Resultados da busca">
          {empty ? (
            <p className="text-base-content/60 py-4 text-center text-sm">
              Nada encontrado para <strong>“{deferred.trim()}”</strong>.
            </p>
          ) : (
            <>
              {results.categories.length > 0 && (
                <div>
                  <p className="eyebrow mb-2">Categorias</p>
                  <ul className="flex flex-wrap gap-2">
                    {results.categories.map((c) => {
                      const selected = normalizeCategoryName(c.name) === normalizeCategoryName(category);
                      return (
                        <li key={c.name}>
                          <button
                            type="button"
                            aria-pressed={selected}
                            onClick={() => setCategory(selected ? '' : c.name)}
                            className={`flex min-h-11 items-center gap-2 rounded-field p-2 pr-3 text-left transition-colors ${
                              selected ? 'bg-base-content text-base-100' : 'bg-base-200 hover:bg-base-300'
                            }`}
                          >
                            <CategoryAvatar category={c.name} size="sm" />
                            <span>
                              <span className="block text-sm font-bold">{c.name}</span>
                              <span className="block text-xs opacity-70">
                                {c.count} {c.count === 1 ? 'lançamento' : 'lançamentos'}
                                {c.expense > 0 && ` · ${BRL.format(c.expense)} gastos`}
                                {c.income > 0 && ` · ${BRL.format(c.income)} recebidos`}
                              </span>
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}


              {shown.length > 0 && (
                <div>
                  <div className="mb-2 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                    <p className="eyebrow">
                      {shown.length === 1 ? '1 lançamento' : `${shown.length} lançamentos`}
                      {category && ` em ${category}`}
                    </p>
                    {!category && (results.totals.expense > 0 || results.totals.income > 0) && (
                      <p className="text-base-content/70 text-xs tabular-nums">
                        {results.totals.expense > 0 && <>Saiu {BRL.format(results.totals.expense)}</>}
                        {results.totals.expense > 0 && results.totals.income > 0 && ' · '}
                        {results.totals.income > 0 && (
                          <span className="text-success">Entrou {BRL.format(results.totals.income)}</span>
                        )}
                      </p>
                    )}
                  </div>
                  <ul className="divide-base-content/5 divide-y">
                    {shown.slice(0, MAX_ROWS).map((t) => (
                      <li key={t.id}>
                        <button
                          type="button"
                          onClick={() => setEditing(t)}
                          className="hover:bg-base-200 -mx-2 flex min-h-12 w-[calc(100%+1rem)] items-center gap-3 rounded-field px-2 py-2 text-left"
                        >
                          <CategoryAvatar category={t.category} size="sm" />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate font-semibold">{t.description}</span>
                            <span className="text-base-content/60 block truncate text-xs">
                              {shortDate(t.date)} · {t.category}
                            </span>
                          </span>
                          <span
                            className={`shrink-0 font-bold tabular-nums ${
                              t.type === 'income' && !t.isTransfer ? 'text-success' : ''
                            }`}
                          >
                            {t.isTransfer ? '↔' : t.type === 'income' ? '+' : '−'} {BRL.format(t.amount)}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                  {shown.length > MAX_ROWS && (
                    <p className="text-base-content/60 mt-2 text-center text-xs">
                      Mostrando os {MAX_ROWS} mais recentes. Refine a busca para ver outros.
                    </p>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      )}

      <TransactionFormDialog open={editing !== undefined} onClose={() => setEditing(undefined)} initial={editing} />
    </section>
  );
}
