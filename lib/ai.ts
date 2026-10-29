import 'server-only';

import type {
  ExtractTransactionResult,
  StructuredJsonRequest,
  StructuredJsonResult,
} from '@/lib/ai-prompt';
import {
  AI_PROVIDERS,
  DEFAULT_AI_PROVIDER,
  isAiProvider,
  type AiProvider,
  type AiProviderStatus,
} from '@/lib/ai-provider';
import type { CreditCardRef } from '@/lib/chat-schemas';
import {
  extractWithGateway,
  gatewayModel,
  generateJsonWithGateway,
  isGatewayConfigured,
} from '@/lib/ai-gateway';
import {
  deepseekModel,
  extractWithDeepseek,
  generateJsonWithDeepseek,
  isDeepseekConfigured,
} from '@/lib/deepseek';
import {
  extractWithGemini,
  geminiModel,
  generateJsonWithGemini,
  isGeminiConfigured,
} from '@/lib/gemini';

export type {
  ExtractionErrorCode,
  ExtractTransactionResult,
  StructuredJsonRequest,
  StructuredJsonResult,
} from '@/lib/ai-prompt';

const PROVIDERS: Record<
  AiProvider,
  {
    configured: () => boolean;
    model: string;
    extract: (
      message: string,
      creditCards: ReadonlyArray<CreditCardRef>,
    ) => Promise<ExtractTransactionResult>;
    generateJson: (request: StructuredJsonRequest) => Promise<StructuredJsonResult>;
  }
> = {
  gateway: {
    configured: isGatewayConfigured,
    model: gatewayModel,
    extract: extractWithGateway,
    generateJson: generateJsonWithGateway,
  },
  gemini: {
    configured: isGeminiConfigured,
    model: geminiModel,
    extract: extractWithGemini,
    generateJson: generateJsonWithGemini,
  },
  deepseek: {
    configured: isDeepseekConfigured,
    model: deepseekModel,
    extract: extractWithDeepseek,
    generateJson: generateJsonWithDeepseek,
  },
};

/** Provedor salvo na tela de configurações; sem escolha válida, usa AI_PROVIDER do .env ou o padrão. */
export function resolveAiProvider(saved: string | undefined | null): AiProvider {
  if (isAiProvider(saved)) return saved;
  const fromEnv = process.env.AI_PROVIDER;
  return isAiProvider(fromEnv) ? fromEnv : DEFAULT_AI_PROVIDER;
}

export function getAiProviderStatuses(): AiProviderStatus[] {
  return AI_PROVIDERS.map((provider) => ({
    provider,
    configured: PROVIDERS[provider].configured(),
    model: PROVIDERS[provider].model,
  }));
}

export function isAiProviderConfigured(provider: AiProvider): boolean {
  return PROVIDERS[provider].configured();
}

export function extractTransactionFromText(
  provider: AiProvider,
  message: string,
  creditCards: ReadonlyArray<CreditCardRef> = [],
): Promise<ExtractTransactionResult> {
  return PROVIDERS[provider].extract(message, creditCards);
}

export function generateStructuredJson(
  provider: AiProvider,
  request: StructuredJsonRequest,
): Promise<StructuredJsonResult> {
  return PROVIDERS[provider].generateJson(request);
}
