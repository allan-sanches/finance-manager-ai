import 'server-only';

import { desc, gte, sql } from 'drizzle-orm';

import { getDb } from '@/lib/db';
import { aiSpend } from '@/lib/db/schema';
import { utcDay } from '@/lib/ai-spend-token';

// Quanto o app gasta com IA no Vercel AI Gateway: a soma de cada dia (UTC), por modelo.
// O gateway devolve o custo e os tokens em toda resposta (`usage`), e o lib/ai-gateway.ts anota
// aqui. Só números: nunca o pedido, a resposta nem o usuário. Quem lê é o dono, por /api/ai-spend.
// O custo fica em microdólares (inteiro), para a soma no banco não acumular erro de ponto flutuante.

type AiCall = {
  model: string;
  ok: boolean;
  inputTokens?: number;
  outputTokens?: number;
  costUsd?: number;
};

const whole = (v: number | undefined) =>
  typeof v === 'number' && Number.isFinite(v) && v > 0 ? Math.round(v) : 0;

/** Soma uma chamada ao dia de hoje. Nunca lança: falhar aqui não pode derrubar a resposta da IA. */
export async function recordAiSpend({ model, ok, inputTokens, outputTokens, costUsd }: AiCall): Promise<void> {
  try {
    const row = {
      day: utcDay(Date.now()),
      model: model.slice(0, 120),
      requests: ok ? 1 : 0,
      failures: ok ? 0 : 1,
      inputTokens: whole(inputTokens),
      outputTokens: whole(outputTokens),
      costMicro: whole((costUsd ?? 0) * 1e6),
    };
    await getDb()
      .insert(aiSpend)
      .values(row)
      .onConflictDoUpdate({
        target: [aiSpend.day, aiSpend.model],
        set: {
          requests: sql`${aiSpend.requests} + ${row.requests}`,
          failures: sql`${aiSpend.failures} + ${row.failures}`,
          inputTokens: sql`${aiSpend.inputTokens} + ${row.inputTokens}`,
          outputTokens: sql`${aiSpend.outputTokens} + ${row.outputTokens}`,
          costMicro: sql`${aiSpend.costMicro} + ${row.costMicro}`,
        },
      });
  } catch (err) {
    console.error('[ai-spend] not recorded', err instanceof Error ? err.message : err);
  }
}

export type AiSpendDay = {
  day: string;
  model: string;
  requests: number;
  failures: number;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
};

/** O gasto dos últimos `days` dias (UTC), do mais recente ao mais antigo. */
export async function recentAiSpend(days: number): Promise<AiSpendDay[]> {
  const since = utcDay(Date.now() - (days - 1) * 86_400_000);
  const rows = await getDb()
    .select()
    .from(aiSpend)
    .where(gte(aiSpend.day, since))
    .orderBy(desc(aiSpend.day), aiSpend.model);
  return rows.map(({ costMicro, ...row }) => ({ ...row, costUsd: costMicro / 1e6 }));
}
