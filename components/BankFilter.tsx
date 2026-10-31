'use client';

import { useState } from 'react';

import { NO_BANK } from '@/lib/bank-filter';
import { useFinanceStore } from '@/lib/store';

/**
 * Filtro de banco guardado na URL (?banco=): sobrevive ao abrir um mês, voltar e recarregar.
 * replaceState troca a URL sem navegar nem empilhar histórico.
 */
export function useBankFilter(initial: string): [string, (value: string) => void] {
  return useUrlFilter('banco', initial);
}

/** Filtro guardado num parâmetro da URL (?banco=, ?categoria=…), sem navegar nem empilhar histórico. */
export function useUrlFilter(param: string, initial: string): [string, (value: string) => void] {
  const [value, setValue] = useState(initial);
  const update = (next: string) => {
    setValue(next);
    const url = new URL(window.location.href);
    if (next) url.searchParams.set(param, next);
    else url.searchParams.delete(param);
    window.history.replaceState(null, '', url);
  };
  return [value, update];
}

/** Chips Todos / cada conta / Sem banco. Some quando não há contas cadastradas. */
export function BankFilter({
  value,
  onChange,
  className = '',
}: {
  value: string;
  onChange: (value: string) => void;
  className?: string;
}) {
  const bankAccounts = useFinanceStore((s) => s.bankAccounts);
  if (bankAccounts.length === 0) return null;

  const options = [
    { id: '', name: 'Todos os bancos' },
    ...bankAccounts.map((a) => ({ id: a.id, name: a.name })),
    { id: NO_BANK, name: 'Sem banco' },
  ];

  return (
    <div
      role="group"
      aria-label="Filtrar por banco"
      className={`no-scrollbar flex gap-2 overflow-x-auto pb-1 ${className}`}
    >
      {options.map((o) => (
        <button
          key={o.id || 'todos'}
          type="button"
          aria-pressed={value === o.id}
          className={`btn btn-sm min-h-11 shrink-0 rounded-full ${
            value === o.id ? 'btn-neutral' : 'btn-ghost bg-base-200'
          }`}
          onClick={() => onChange(o.id)}
        >
          {o.name}
        </button>
      ))}
    </div>
  );
}
