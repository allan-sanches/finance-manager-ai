import 'server-only';

import { GoogleGenAI, Type, type Schema } from '@google/genai';

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
import type { PaymentMethod, TransactionType } from '@/types/finance';

const apiKey = process.env.GEMINI_API_KEY;
export const geminiModel = process.env.GEMINI_MODEL ?? 'gemini-2.5-flash';

const ai = apiKey ? new GoogleGenAI({ apiKey }) : null;

export const isGeminiConfigured = (): boolean => ai !== null;

const transactionTypes: ReadonlyArray<TransactionType> = ['income', 'expense'];
const paymentMethods: ReadonlyArray<PaymentMethod> = [
  'cash',
  'debit',
  'credit_card',
  'pix',
  'bank_transfer',
];

// Exportado: o AI Gateway converte este mesmo schema para JSON Schema.
export const buildExtractionSchema = (creditCards: ReadonlyArray<CreditCardRef>): Schema => ({
  type: Type.OBJECT,
  required: ['transaction', 'confidence'],
  properties: {
    transaction: {
      type: Type.OBJECT,
      required: [
        'description',
        'amount',
        'type',
        'category',
        'paymentMethod',
        'date',
        'isFixed',
      ],
      properties: {
        description: {
          type: Type.STRING,
          description: 'Resumo curto e legível do lançamento (ex: "Jantar no iFood")',
        },
        amount: {
          type: Type.NUMBER,
          description: 'Valor positivo em reais (BRL). Apenas o número, sem símbolo.',
        },
        type: {
          type: Type.STRING,
          enum: [...transactionTypes],
          description: '"expense" para gastos, "income" para receitas',
        },
        category: {
          type: Type.STRING,
          description:
            'Uma categoria normalizada em português, ex: "Alimentação", "Moradia", "Transporte", "Lazer", "Saúde", "Educação", "Salário", "Outros"',
        },
        paymentMethod: {
          type: Type.STRING,
          enum: [...paymentMethods],
        },
        creditCardId: {
          type: Type.STRING,
          nullable: true,
          ...(creditCards.length > 0 ? { enum: creditCards.map((c) => c.id) } : {}),
          description:
            'ID de um dos cartões cadastrados se paymentMethod = "credit_card", senão null',
        },
        date: {
          type: Type.STRING,
          description: 'Data no formato YYYY-MM-DD. Se omitida na frase, usar a data atual.',
        },
        isFixed: {
          type: Type.BOOLEAN,
          description: 'true se for despesa/receita recorrente mensal, false caso contrário',
        },
        isPaid: {
          type: Type.BOOLEAN,
          description: 'true se já foi pago/recebido, false se ainda está em aberto',
        },
      },
    },
    confidence: {
      type: Type.STRING,
      enum: ['low', 'medium', 'high'],
      description: 'Quão confiante a extração está, considerando ambiguidade da frase',
    },
    notes: {
      type: Type.STRING,
      description: 'Observações opcionais para o usuário sobre suposições feitas',
    },
  },
});

export async function generateJsonWithGemini(
  request: StructuredJsonRequest,
): Promise<StructuredJsonResult> {
  if (!ai) {
    return { ok: false, code: 'not_configured', error: NOT_CONFIGURED_ERROR };
  }

  let raw: string | undefined;
  try {
    const response = await ai.models.generateContent({
      model: geminiModel,
      contents: request.content,
      config: {
        systemInstruction: request.systemInstruction,
        responseMimeType: 'application/json',
        responseSchema: request.geminiSchema,
        maxOutputTokens: request.maxOutputTokens,
        temperature: 0,
      },
    });
    raw = response.text;
  } catch (err) {
    console.error('[gemini] generateContent failed', err);
    return { ok: false, code: 'upstream_error', error: UPSTREAM_ERROR };
  }

  try {
    return { ok: true, value: raw ? JSON.parse(raw) : null };
  } catch {
    console.error('[gemini] response is not valid JSON');
    return { ok: false, code: 'invalid_output', error: INVALID_OUTPUT_ERROR };
  }
}

export async function extractWithGemini(
  message: string,
  creditCards: ReadonlyArray<CreditCardRef> = [],
  categories?: ReadonlyArray<string>,
): Promise<ExtractTransactionResult> {
  if (!ai) {
    return { ok: false, code: 'not_configured', error: NOT_CONFIGURED_ERROR };
  }

  let raw: string | undefined;
  try {
    const response = await ai.models.generateContent({
      model: geminiModel,
      contents: message,
      config: {
        systemInstruction: buildSystemInstruction(creditCards, categories),
        responseMimeType: 'application/json',
        responseSchema: buildExtractionSchema(creditCards),
        temperature: 0.2,
      },
    });
    raw = response.text;
  } catch (err) {
    console.error('[gemini] generateContent failed', err);
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
    console.error('[gemini] response outside expected schema', raw);
    return { ok: false, code: 'invalid_output', error: INVALID_OUTPUT_ERROR };
  }

  return { ok: true, data };
}
