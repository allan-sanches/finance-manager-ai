import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { migrate } from 'drizzle-orm/pglite/migrator';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import * as schema from '@/lib/db/schema';

// Postgres real em memória (PGlite) com as mesmas migrações do deploy.
vi.setConfig({ testTimeout: 30_000, hookTimeout: 30_000 });

const state = vi.hoisted(() => ({ db: null as unknown }));
vi.mock('@/lib/db', () => ({
  getDb: () => {
    if (!state.db) throw new Error('DATABASE_URL não está definida.');
    return state.db;
  },
}));

import { recentAiSpend, recordAiSpend } from '@/lib/ai-spend';

beforeEach(async () => {
  const instance = drizzle({ client: new PGlite(), schema });
  await migrate(instance, { migrationsFolder: './drizzle' });
  state.db = instance;
});

describe('recordAiSpend', () => {
  it('soma as chamadas do mesmo dia e modelo numa linha só', async () => {
    await recordAiSpend({ model: 'openai/gpt-5-mini', ok: true, inputTokens: 100, outputTokens: 20, costUsd: 0.0000088 });
    await recordAiSpend({ model: 'openai/gpt-5-mini', ok: true, inputTokens: 50, outputTokens: 10, costUsd: 0.0012 });
    await recordAiSpend({ model: 'openai/gpt-5-mini', ok: false });
    await recordAiSpend({ model: 'google/gemini-2.5-flash-lite', ok: true, inputTokens: 7, outputTokens: 3 });

    const days = await recentAiSpend(35);
    expect(days).toHaveLength(2);
    expect(days.find((d) => d.model === 'openai/gpt-5-mini')).toMatchObject({
      requests: 2,
      failures: 1,
      inputTokens: 150,
      outputTokens: 30,
      costUsd: 0.001209,
    });
    expect(days.find((d) => d.model === 'google/gemini-2.5-flash-lite')).toMatchObject({
      requests: 1,
      failures: 0,
      costUsd: 0,
    });
  });

  it('não lança quando o banco falha: a resposta da IA não pode cair por causa do registro', async () => {
    state.db = null;
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    await expect(recordAiSpend({ model: 'openai/gpt-5-mini', ok: true })).resolves.toBeUndefined();
    expect(log).toHaveBeenCalled();
    log.mockRestore();
  });
});
