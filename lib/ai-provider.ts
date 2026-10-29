// Catálogo de provedores de IA. Sem "server-only": a tela de configurações (client) usa os rótulos.
// Nenhuma chave ou segredo mora aqui — as chaves ficam só nas variáveis de ambiente do servidor.

export const AI_PROVIDERS = ['gateway', 'gemini', 'deepseek'] as const;

export type AiProvider = (typeof AI_PROVIDERS)[number];

export const DEFAULT_AI_PROVIDER: AiProvider = 'gateway';

export const AI_PROVIDER_COOKIE = 'fm_ai_provider';

export const AI_PROVIDER_LABEL: Record<AiProvider, string> = {
  gateway: 'Vercel AI Gateway',
  gemini: 'Google Gemini',
  deepseek: 'DeepSeek',
};

export function isAiProvider(value: unknown): value is AiProvider {
  return typeof value === 'string' && (AI_PROVIDERS as ReadonlyArray<string>).includes(value);
}

export type AiProviderStatus = {
  provider: AiProvider;
  configured: boolean;
  model: string;
};
