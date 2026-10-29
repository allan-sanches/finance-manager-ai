import { describe, expect, it } from 'vitest';

import { mergeCategoryNames } from '@/lib/finance';
import { categoryStyle } from '@/lib/tones';

describe('mergeCategoryNames', () => {
  it('põe as do usuário antes de "Outros", em ordem alfabética, sem repetir as padrão', () => {
    const names = mergeCategoryNames([{ name: 'Viagem' }, { name: 'Pet' }, { name: 'moradia' }]);
    expect(names.slice(-3)).toEqual(['Pet', 'Viagem', 'Outros']);
    expect(names.filter((n) => n.toLowerCase() === 'moradia')).toHaveLength(1);
  });
});

describe('categoryStyle', () => {
  it('usa o estilo da categoria do usuário, ignorando maiúsculas e acentos', () => {
    const custom = [{ name: 'Pet', emoji: '🐾', tone: 'amber' as const }];
    expect(categoryStyle('pét', custom)).toEqual({ emoji: '🐾', tone: 'amber' });
  });

  it('cai em "Outros" para nome desconhecido e reconhece Dívidas', () => {
    expect(categoryStyle('Mobilidade').emoji).toBe('🏷️');
    expect(categoryStyle('Dívidas').tone).toBe('red');
  });
});
