import type { Transaction } from '@/types/finance';

// Funções puras do filtro de banco: ficam fora do componente ('use client') porque a rota do mês
// (server) também lê o ?banco= da URL.

/** Valor do filtro para "só os sem tag de banco"; '' = todos os bancos. */
export const NO_BANK = '__sem-banco__';

export const matchesBank = (tx: Pick<Transaction, 'bankAccountId'>, filter: string): boolean =>
  !filter || (tx.bankAccountId ?? NO_BANK) === filter;

/** `?banco=` da URL → valor do filtro ('' quando ausente). */
export const bankParam = (value: string | string[] | undefined): string =>
  typeof value === 'string' ? value : '';

/** Link mantendo o filtro de banco ativo. */
export const withBank = (href: string, bank: string) =>
  bank ? `${href}?banco=${encodeURIComponent(bank)}` : href;
