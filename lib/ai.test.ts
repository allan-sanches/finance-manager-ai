import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('resolveAiProvider', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('respeita a escolha salva quando válida', async () => {
    vi.stubEnv('AI_PROVIDER', 'gemini');
    const { resolveAiProvider } = await import('@/lib/ai');
    expect(resolveAiProvider('deepseek')).toBe('deepseek');
  });

  it('cai para AI_PROVIDER do .env quando o valor salvo é inválido', async () => {
    vi.stubEnv('AI_PROVIDER', 'deepseek');
    const { resolveAiProvider } = await import('@/lib/ai');
    expect(resolveAiProvider('openai')).toBe('deepseek');
    expect(resolveAiProvider(undefined)).toBe('deepseek');
  });

  it('usa o AI Gateway como padrão final', async () => {
    vi.stubEnv('AI_PROVIDER', '');
    const { resolveAiProvider } = await import('@/lib/ai');
    expect(resolveAiProvider(null)).toBe('gateway');
  });

  it('informa quais provedores têm chave sem expor a chave', async () => {
    vi.stubEnv('AI_GATEWAY_API_KEY', '');
    vi.stubEnv('GEMINI_API_KEY', '');
    vi.stubEnv('DEEPSEEK_API_KEY', 'secret');
    const { getAiProviderStatuses } = await import('@/lib/ai');
    const statuses = getAiProviderStatuses();
    expect(statuses.map((s) => [s.provider, s.configured])).toEqual([
      ['gateway', false],
      ['gemini', false],
      ['deepseek', true],
    ]);
    expect(JSON.stringify(statuses)).not.toContain('secret');
  });
});
