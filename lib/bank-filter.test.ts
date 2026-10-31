import { describe, expect, it } from 'vitest';

import { matchesBank, matchesCategory, NO_BANK, withParams } from '@/lib/bank-filter';

describe('filtros da URL', () => {
  it('categoria: vazio passa tudo; compara sem maiúsculas e acentos', () => {
    expect(matchesCategory({ category: 'Alimentação' }, '')).toBe(true);
    expect(matchesCategory({ category: 'Alimentação' }, 'alimentacao')).toBe(true);
    expect(matchesCategory({ category: 'Moradia' }, 'Alimentação')).toBe(false);
  });

  it('banco: "Sem banco" pega só os sem tag', () => {
    expect(matchesBank({ bankAccountId: null }, NO_BANK)).toBe(true);
    expect(matchesBank({ bankAccountId: 'inter' }, NO_BANK)).toBe(false);
  });

  it('withParams monta a URL só com os filtros preenchidos', () => {
    expect(withParams('/transacoes/2026-10', { banco: '', categoria: '' })).toBe('/transacoes/2026-10');
    expect(withParams('/transacoes/2026-10', { banco: 'mp', categoria: 'Alimentação' })).toBe(
      '/transacoes/2026-10?banco=mp&categoria=Alimenta%C3%A7%C3%A3o',
    );
  });
});
