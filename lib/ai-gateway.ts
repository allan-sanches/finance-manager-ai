import 'server-only';

import { Type, type Schema } from '@google/genai';

import {
  buildSystemInstruction,
  INVALID_OUTPUT_ERROR,
  NOT_CONFIGURED_ERROR,
  UPSTREAM_ERROR,
  type ExtractTransactionResult,
  type StructuredJsonRequest,
  type StructuredJsonResult,
} from '@/lib/ai-prompt';
import { parseExtraction, type CreditCardRef } from '@/lib/chat-schemas';
import { buildExtractionSchema } from '@/lib/gemini';

// Vercel AI Gateway: endpoint compatível com OpenAI que roteia para o provedor do modelo
// (ex: "openai/gpt-5-mini" é servido pela OpenAI e pela Azure, ambas com retenção zero).
// Diferente da API direta do DeepSeek, aceita response_format json_schema (Structured Outputs).

const apiKey = process.env.AI_GATEWAY_API_KEY;
export const gatewayModel = process.env.AI_GATEWAY_MODEL ?? 'openai/gpt-5-mini';
const baseUrl = (process.env.AI_GATEWAY_BASE_URL ?? 'https://ai-gateway.vercel.sh/v1').replace(
  /\/+$/,
  '',
);
// Só roteia para provedores com acordo de retenção zero com a Vercel. Exige plano Pro ou
// Enterprise (no Hobby a requisição volta 403). Opcional: se nenhum
// provedor do modelo tiver o acordo, a requisição falha.
const zeroDataRetention = process.env.AI_GATEWAY_ZERO_DATA_RETENTION === 'true';

const GATEWAY_REJECTED_ERROR =
  'O AI Gateway recusou a requisição (chave, plano ou modelo indisponível no plano). Confira AI_GATEWAY_API_KEY e AI_GATEWAY_MODEL.';

const CHAT_TIMEOUT_MS = 30_000;
// Extrato de mês cheio: ~1 min por 150 lançamentos mesmo com raciocínio mínimo.
const DOCUMENT_TIMEOUT_MS = 180_000;
const CONVERSATION_TIMEOUT_MS = 60_000;

export const isGatewayConfigured = (): boolean => Boolean(apiKey);

export type JsonSchema = {
  type: string | string[];
  description?: string;
  enum?: Array<string | null>;
  items?: JsonSchema;
  properties?: Record<string, JsonSchema>;
  required?: string[];
};

const JSON_TYPE: Partial<Record<Type, string>> = {
  [Type.OBJECT]: 'object',
  [Type.ARRAY]: 'array',
  [Type.STRING]: 'string',
  [Type.NUMBER]: 'number',
  [Type.INTEGER]: 'integer',
  [Type.BOOLEAN]: 'boolean',
};

/** Os schemas já existem no formato do SDK do Gemini; aqui viram JSON Schema padrão. */
export function toJsonSchema(schema: Schema): JsonSchema {
  const type = (schema.type && JSON_TYPE[schema.type]) ?? 'string';
  const out: JsonSchema = { type: schema.nullable ? [type, 'null'] : type };
  if (schema.description) out.description = schema.description;
  if (schema.enum) out.enum = schema.nullable ? [...schema.enum, null] : [...schema.enum];
  if (schema.items) out.items = toJsonSchema(schema.items);
  if (schema.properties) {
    out.properties = Object.fromEntries(
      Object.entries(schema.properties).map(([key, value]) => [key, toJsonSchema(value)]),
    );
  }
  if (schema.required) out.required = [...schema.required];
  return out;
}

type ChatCompletionResponse = {
  choices?: Array<{ message?: { content?: string | null } }>;
};

async function complete(
  request: StructuredJsonRequest,
  timeoutMs: number,
): Promise<StructuredJsonResult> {
  if (!apiKey) {
    return { ok: false, code: 'not_configured', error: NOT_CONFIGURED_ERROR };
  }

  let raw: string | null | undefined;
  try {
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: gatewayModel,
        messages: [
          // "json" no prompt: alguns provedores do roteamento exigem a palavra para o modo JSON.
          {
            role: 'system',
            content: `${request.systemInstruction} Responda somente com o objeto json do schema.`,
          },
          {
            role: 'user',
            // Com imagens, o conteúdo vira a lista multimodal do formato OpenAI (texto + data URIs).
            content: request.images?.length
              ? [
                  { type: 'text', text: request.content },
                  ...request.images.map((img) => ({
                    type: 'image_url',
                    image_url: { url: `data:${img.mimeType};base64,${img.base64}` },
                  })),
                ]
              : request.content,
          },
        ],
        response_format: {
          type: 'json_schema',
          json_schema: { name: 'response', schema: toJsonSchema(request.geminiSchema) },
        },
        // GPT-5 raciocina por padrão (esforço médio): num extrato longo isso passa dos 120 s do
        // timeout. Transcrever lançamentos não pede raciocínio — vai com o esforço mínimo, e esses
        // modelos não aceitam temperature.
        ...(gatewayModel.startsWith('openai/gpt-5')
          ? { reasoning: { effort: 'minimal' } }
          : { temperature: 0 }),
        max_tokens: request.maxOutputTokens,
        stream: false,
        ...(zeroDataRetention ? { providerOptions: { gateway: { zeroDataRetention: true } } } : {}),
      }),
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!response.ok) {
      console.error('[ai-gateway] chat/completions failed', response.status, await response.text());
      // 401/403 vêm de chave, plano ou modelo fora do plano: tentar de novo não resolve.
      const error =
        response.status === 401 || response.status === 403
          ? GATEWAY_REJECTED_ERROR
          : UPSTREAM_ERROR;
      return { ok: false, code: 'upstream_error', error };
    }
    const payload = (await response.json()) as ChatCompletionResponse;
    raw = payload.choices?.[0]?.message?.content;
  } catch (err) {
    console.error('[ai-gateway] chat/completions failed', err);
    return { ok: false, code: 'upstream_error', error: UPSTREAM_ERROR };
  }

  try {
    return { ok: true, value: raw ? JSON.parse(raw) : null };
  } catch {
    console.error('[ai-gateway] response is not valid JSON');
    return { ok: false, code: 'invalid_output', error: INVALID_OUTPUT_ERROR };
  }
}

export function generateJsonWithGateway(
  request: StructuredJsonRequest,
): Promise<StructuredJsonResult> {
  return complete(request, DOCUMENT_TIMEOUT_MS);
}

export type GatewayChatMessage = { role: 'system' | 'user' | 'assistant'; content: string };

/**
 * Conversa com histórico e saída em JSON Schema (o assistente Marx). Raciocínio desligado: no
 * celular a resposta rápida vale mais. Os GPT-5 não desligam o raciocínio nem aceitam temperature:
 * vão com o esforço mínimo. Quem chama valida o objeto devolvido.
 */
export async function chatJsonWithGateway(
  model: string,
  messages: ReadonlyArray<GatewayChatMessage>,
  schema: JsonSchema,
  { temperature = 0.7, maxTokens = 4096 }: { temperature?: number; maxTokens?: number } = {},
): Promise<StructuredJsonResult> {
  const alwaysReasons = model.startsWith('openai/gpt-5');
  if (!apiKey) {
    return { ok: false, code: 'not_configured', error: NOT_CONFIGURED_ERROR };
  }

  let raw: string | null | undefined;
  try {
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages,
        response_format: { type: 'json_schema', json_schema: { name: 'response', schema } },
        ...(alwaysReasons ? { reasoning: { effort: 'minimal' } } : { reasoning: { enabled: false }, temperature }),
        max_tokens: maxTokens,
        stream: false,
        ...(zeroDataRetention ? { providerOptions: { gateway: { zeroDataRetention: true } } } : {}),
      }),
      signal: AbortSignal.timeout(CONVERSATION_TIMEOUT_MS),
    });
    if (!response.ok) {
      console.error('[ai-gateway] chat/completions failed', response.status, await response.text());
      const error =
        response.status === 401 || response.status === 403
          ? GATEWAY_REJECTED_ERROR
          : UPSTREAM_ERROR;
      return { ok: false, code: 'upstream_error', error };
    }
    const payload = (await response.json()) as ChatCompletionResponse;
    raw = payload.choices?.[0]?.message?.content;
  } catch (err) {
    console.error('[ai-gateway] chat/completions failed', err);
    return { ok: false, code: 'upstream_error', error: UPSTREAM_ERROR };
  }

  try {
    return { ok: true, value: raw ? JSON.parse(raw) : null };
  } catch {
    console.error('[ai-gateway] response is not valid JSON');
    return { ok: false, code: 'invalid_output', error: INVALID_OUTPUT_ERROR };
  }
}

export async function extractWithGateway(
  message: string,
  creditCards: ReadonlyArray<CreditCardRef> = [],
  categories?: ReadonlyArray<string>,
): Promise<ExtractTransactionResult> {
  const result = await complete(
    {
      systemInstruction: buildSystemInstruction(creditCards, categories),
      content: message,
      geminiSchema: buildExtractionSchema(creditCards),
      jsonExample: null,
      maxOutputTokens: 1024,
    },
    CHAT_TIMEOUT_MS,
  );
  if (!result.ok) return result;

  const data = parseExtraction(
    result.value,
    creditCards.map((c) => c.id),
  );
  if (!data) {
    console.error('[ai-gateway] response outside expected schema');
    return { ok: false, code: 'invalid_output', error: INVALID_OUTPUT_ERROR };
  }
  return { ok: true, data };
}
