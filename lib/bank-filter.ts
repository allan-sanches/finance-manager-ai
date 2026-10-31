import { normalizeCategoryName } from '@/lib/tones';
import type { Transaction } from '@/types/finance';

// Funções puras dos filtros da URL (banco e categoria): ficam fora do componente ('use client') porque a rota do mês
// (server) também lê ?banco= e ?categoria=.

/** Valor do filtro para "só os sem tag de banco"; '' = todos os bancos. */
export const NO_BANK = '__sem-banco__';

export const matchesBank = (tx: Pick<Transaction, 'bankAccountId'>, filter: string): boolean =>
  !filter || (tx.bankAccountId ?? NO_BANK) === filter;

/** Parâmetro da URL (?banco=, ?categoria=) → valor do filtro ('' quando ausente). */
export const bankParam = (value: string | string[] | undefined): string =>
  typeof value === 'string' ? value : '';

// ---------- Filtro de categoria (?categoria=) ----------

/** Lançamento da categoria escolhida ('' = todas), sem ligar para maiúsculas/acentos. */
export const matchesCategory = (tx: Pick<Transaction, 'category'>, category: string): boolean =>
  !category || normalizeCategoryName(tx.category) === normalizeCategoryName(category);

/** Link com os filtros ativos na URL (vazios ficam de fora). */
export function withParams(href: string, params: Record<string, string>): string {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) if (value) query.set(key, value);
  const qs = query.toString();
  return qs ? `${href}?${qs}` : href;
}
