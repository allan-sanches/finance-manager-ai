import { describe, expect, it } from 'vitest';

import { DEFAULT_MARX_MODEL, resolveMarxModel } from '@/lib/marx/models';

describe('resolveMarxModel', () => {
  it('usa a escolha do chat quando é da lista', () => {
    expect(resolveMarxModel('deepseek/deepseek-v3.1', 'openai/gpt-5-mini')).toBe('deepseek/deepseek-v3.1');
  });

  it('ignora escolha fora da lista e cai no MARX_MODEL do servidor', () => {
    expect(resolveMarxModel('openai/gpt-5-pro', 'openai/gpt-5-mini')).toBe('openai/gpt-5-mini');
  });

  it('sem escolha nem MARX_MODEL válido, usa o padrão', () => {
    expect(resolveMarxModel(undefined, 'qualquer/coisa')).toBe(DEFAULT_MARX_MODEL);
    expect(resolveMarxModel(null, undefined)).toBe(DEFAULT_MARX_MODEL);
  });
});
