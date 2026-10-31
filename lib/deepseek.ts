import 'server-only';

import {
  buildSystemInstruction,
  IMAGES_NOT_SUPPORTED_ERROR,
  INVALID_OUTPUT_ERROR,
  NOT_CONFIGURED_ERROR,
  UPSTREAM_ERROR,
  type ExtractTransactionResult,
  type StructuredJsonRequest,
  type StructuredJsonResult,
} from '@/lib/ai-prompt';
import { parseExtraction, type CreditCardRef } from '@/lib/chat-schemas';

const apiKey = process.env.DEEPSEEK_API_KEY;
export const deepseekModel = process.env.DEEPSEEK_MODEL ?? 'deepseek-flash';
const baseUrl = (process.env.DEEPSEEK_BASE_URL ?? 'https://api.deepseek.com').replace(/\/+$/, '');

const TIMEOUT_MS = 30_000;

export const isDeepseekConfigured = (): boolean => Boolean(apiKey);

// O DeepSeek só tem JSON mode ("json_object"), sem schema: o formato vai descrito no prompt
// (a API exige a palavra "json" e um exemplo) e o parseExtraction faz a validação estrita.
const buildJsonFormatInstruction = (): string =>
  [
    'Responda SOMENTE com um objeto json válido, sem texto fora dele, neste formato:',
    JSON.stringify({
      transaction: {
        description: 'Jantar no iFood',
        amount: 45,
        type: 'expense | income',
        category: 'Alimentação',
        paymentMethod: 'cash | debit | credit_card | pix | bank_transfer',
        creditCardId: 'id do cartão ou null',
        date: 'YYYY-MM-DD',
        isFixed: false,
        isPaid: true,
      },
      confidence: 'low | medium | high',
      notes: 'observações opcionais sobre suposições feitas',
    }),
    'amount é número positivo em reais, sem símbolo. Os campos com "|" aceitam exatamente um dos valores listados.',
  ].join(' ');

type ChatCompletionResponse = {
  choices?: Array<{ message?: { content?: string | null }; finish_reason?: string }>;
};

// Documentos (extratos, relatórios) geram respostas longas: mais tempo e tokens que a frase do chat.
const DOCUMENT_TIMEOUT_MS = 120_000;

export async function generateJsonWithDeepseek(
  request: StructuredJsonRequest,
): Promise<StructuredJsonResult> {
  if (!apiKey) {
    return { ok: false, code: 'not_configured', error: NOT_CONFIGURED_ERROR };
  }
  // A API do DeepSeek é só texto.
  if (request.images?.length) {
    return { ok: false, code: 'not_configured', error: IMAGES_NOT_SUPPORTED_ERROR };
  }

  const formatInstruction = [
    'Responda SOMENTE com um objeto json válido, sem texto fora dele, neste formato:',
    JSON.stringify(request.jsonExample),
    'Os campos com "|" aceitam exatamente um dos valores listados.',
  ].join(' ');

  let raw: string | null | undefined;
  try {
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: deepseekModel,
        messages: [
          { role: 'system', content: `${request.systemInstruction} ${formatInstruction}` },
          { role: 'user', content: request.content },
        ],
        response_format: { type: 'json_object' },
        thinking: { type: 'disabled' },
        temperature: 0,
        // O JSON mode do DeepSeek limita a saída a 8K tokens.
        max_tokens: Math.min(request.maxOutputTokens, 8192),
        stream: false,
      }),
      signal: AbortSignal.timeout(DOCUMENT_TIMEOUT_MS),
    });
    if (!response.ok) {
      console.error('[deepseek] chat/completions failed', response.status, await response.text());
      return { ok: false, code: 'upstream_error', error: UPSTREAM_ERROR };
    }
    const payload = (await response.json()) as ChatCompletionResponse;
    raw = payload.choices?.[0]?.message?.content;
  } catch (err) {
    console.error('[deepseek] chat/completions failed', err);
    return { ok: false, code: 'upstream_error', error: UPSTREAM_ERROR };
  }

  try {
    return { ok: true, value: raw ? JSON.parse(raw) : null };
  } catch {
    console.error('[deepseek] response is not valid JSON');
    return { ok: false, code: 'invalid_output', error: INVALID_OUTPUT_ERROR };
  }
}

export type DeepseekChatMessage = { role: 'system' | 'user' | 'assistant'; content: string };

const CONVERSATION_TIMEOUT_MS = 60_000;

/**
 * Conversa em JSON mode (o assistente Marx): o histórico vai inteiro e o system prompt já precisa
 * descrever o formato com a palavra "json". Quem chama valida o objeto devolvido.
 */
export async function chatJsonWithDeepseek(
  messages: ReadonlyArray<DeepseekChatMessage>,
  { temperature = 0.7, maxTokens = 4096 }: { temperature?: number; maxTokens?: number } = {},
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
        model: deepseekModel,
        messages,
        response_format: { type: 'json_object' },
        // Sem raciocínio: no celular a resposta rápida vale mais; a temperatura só vale assim.
        thinking: { type: 'disabled' },
        temperature,
        max_tokens: Math.min(maxTokens, 8192),
        stream: false,
      }),
      signal: AbortSignal.timeout(CONVERSATION_TIMEOUT_MS),
    });
    if (!response.ok) {
      console.error('[deepseek] chat/completions failed', response.status, await response.text());
      return { ok: false, code: 'upstream_error', error: UPSTREAM_ERROR };
    }
    const payload = (await response.json()) as ChatCompletionResponse;
    raw = payload.choices?.[0]?.message?.content;
  } catch (err) {
    console.error('[deepseek] chat/completions failed', err);
    return { ok: false, code: 'upstream_error', error: UPSTREAM_ERROR };
  }

  try {
    return { ok: true, value: raw ? JSON.parse(raw) : null };
  } catch {
    console.error('[deepseek] response is not valid JSON');
    return { ok: false, code: 'invalid_output', error: INVALID_OUTPUT_ERROR };
  }
}

export async function extractWithDeepseek(
  message: string,
  creditCards: ReadonlyArray<CreditCardRef> = [],
  categories?: ReadonlyArray<string>,
): Promise<ExtractTransactionResult> {
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
        model: deepseekModel,
        messages: [
          {
            role: 'system',
            content: `${buildSystemInstruction(creditCards, categories)} ${buildJsonFormatInstruction()}`,
          },
          { role: 'user', content: message },
        ],
        response_format: { type: 'json_object' },
        // Extração é tarefa curta: sem modo de raciocínio, para responder rápido e respeitar a temperatura.
        thinking: { type: 'disabled' },
        temperature: 0.2,
        max_tokens: 1024,
        stream: false,
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!response.ok) {
      console.error('[deepseek] chat/completions failed', response.status, await response.text());
      return { ok: false, code: 'upstream_error', error: UPSTREAM_ERROR };
    }
    const payload = (await response.json()) as ChatCompletionResponse;
    raw = payload.choices?.[0]?.message?.content;
  } catch (err) {
    console.error('[deepseek] chat/completions failed', err);
    return { ok: false, code: 'upstream_error', error: UPSTREAM_ERROR };
  }

  let parsed: unknown;
  try {
    parsed = raw ? JSON.parse(raw) : null;
  } catch {
    parsed = null;
  }

  const data = parseExtraction(
    parsed,
    creditCards.map((c) => c.id),
  );
  if (!data) {
    console.error('[deepseek] response outside expected schema', raw);
    return { ok: false, code: 'invalid_output', error: INVALID_OUTPUT_ERROR };
  }

  return { ok: true, data };
}
