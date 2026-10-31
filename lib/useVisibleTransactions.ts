'use client';

import { useMemo } from 'react';

import { withoutHiddenCategories } from '@/lib/finance';
import { useFinanceStore } from '@/lib/store';
import type { Transaction } from '@/types/finance';

/**
 * Lançamentos sem as categorias ocultas (Configurações → Categorias). Use nas listas, gráficos e
 * totais; para saldo de conta e limite de cartão use `s.transactions`, que tem tudo.
 */
export function useVisibleTransactions(): Transaction[] {
  const transactions = useFinanceStore((s) => s.transactions);
  const hidden = useFinanceStore((s) => s.settings.hiddenCategories);
  return useMemo(() => withoutHiddenCategories(transactions, hidden ?? []), [transactions, hidden]);
}
