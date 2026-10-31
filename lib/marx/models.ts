// Modelos que o Marx pode usar pelo Vercel AI Gateway. Sem "server-only": o chat mostra a lista.
// Só ids desta lista passam pela rota; nenhuma chave mora aqui.
// Tempos medidos com o prompt real (oi / gasto / análise), plano gratuito do Gateway, out/2026.

export const MARX_MODELS = [
  { id: 'openai/gpt-4.1-mini', label: 'ChatGPT 4.1 mini', hint: 'mais rápido (~1,4s)' },
  { id: 'openai/gpt-5-mini', label: 'ChatGPT 5 mini', hint: 'análises mais completas (~2,5s)' },
  { id: 'google/gemini-2.5-flash-lite', label: 'Gemini 2.5 Flash Lite', hint: 'rápido (~1,5s)' },
  { id: 'deepseek/deepseek-v3.1', label: 'DeepSeek V3.1', hint: 'mais lento (~6s)' },
] as const;

export type MarxModelId = (typeof MARX_MODELS)[number]['id'];

export const DEFAULT_MARX_MODEL: MarxModelId = 'openai/gpt-4.1-mini';

export const MARX_MODEL_IDS = MARX_MODELS.map((m) => m.id) as [MarxModelId, ...MarxModelId[]];

export function isMarxModel(value: unknown): value is MarxModelId {
  return typeof value === 'string' && (MARX_MODEL_IDS as ReadonlyArray<string>).includes(value);
}

export const marxModelLabel = (id: string): string => MARX_MODELS.find((m) => m.id === id)?.label ?? id;

/** Escolha do chat; sem ela, MARX_MODEL do servidor (se for da lista) ou o padrão. */
export function resolveMarxModel(chosen: string | undefined | null, fromEnv = process.env.MARX_MODEL): MarxModelId {
  if (isMarxModel(chosen)) return chosen;
  return isMarxModel(fromEnv) ? fromEnv : DEFAULT_MARX_MODEL;
}
