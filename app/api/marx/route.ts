import { NextResponse } from 'next/server';

import type { ExtractionErrorCode } from '@/lib/ai';
import { getSessionUserId } from '@/lib/auth';
import { getDb } from '@/lib/db';
import { getSnapshot } from '@/lib/db/repository';
import { chatJsonWithDeepseek } from '@/lib/deepseek';
import { mergeCategoryNames, todayISO } from '@/lib/finance';
import { buildFinanceContext } from '@/lib/marx/context';
import { buildMarxSystemPrompt, toDeepseekMessages } from '@/lib/marx/prompt';
import { getMarketQuotes } from '@/lib/marx/quotes';
import { marxRequestSchema, parseMarxReply } from '@/lib/marx/schemas';
import { clientKeyFromRequest, createRateLimiter } from '@/lib/rate-limit';

// Assistente Marx: conversa com o DeepSeek sobre os dados do usuário logado. Os dados saem do
// banco aqui no servidor (pela sessão), nunca do que o navegador manda; a chave fica no servidor.

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const checkRateLimit = createRateLimiter({ limit: 20, windowMs: 60_000 });

const STATUS_BY_ERROR: Record<ExtractionErrorCode, number> = {
  not_configured: 503,
  invalid_output: 422,
  upstream_error: 502,
};

const NOT_CONFIGURED =
  'O Marx está de folga: falta configurar a DEEPSEEK_API_KEY no servidor.';
const CONFUSED = 'O Marx se enrolou com essa. Tenta perguntar de outro jeito?';

export async function POST(request: Request) {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ ok: false, error: 'Não autenticado.' }, { status: 401 });
  }

  const rate = checkRateLimit(`marx:${userId}:${clientKeyFromRequest(request)}`);
  if (!rate.allowed) {
    return NextResponse.json(
      { ok: false, error: 'Calma, camarada! Muitas mensagens seguidas. Espera um pouquinho.' },
      { status: 429, headers: { 'Retry-After': String(rate.retryAfterSeconds) } },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'Payload inválido (JSON malformado).' }, { status: 400 });
  }
  const parsed = marxRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: parsed.error.issues[0]?.message ?? 'Payload inválido.' },
      { status: 400 },
    );
  }

  const [snapshot, quotes] = await Promise.all([getSnapshot(getDb(), userId), getMarketQuotes()]);
  const today = todayISO();
  const categories = mergeCategoryNames(snapshot.categories);
  const system = buildMarxSystemPrompt({
    today,
    categories,
    financeContext: buildFinanceContext(snapshot, quotes, today),
  });

  const result = await chatJsonWithDeepseek(toDeepseekMessages(system, parsed.data.messages));
  if (!result.ok) {
    const error = result.code === 'not_configured' ? NOT_CONFIGURED : result.code === 'invalid_output' ? CONFUSED : result.error;
    return NextResponse.json({ ok: false, error }, { status: STATUS_BY_ERROR[result.code] });
  }

  const reply = parseMarxReply(result.value, {
    cardIds: snapshot.creditCards.map((c) => c.id),
    accountIds: snapshot.bankAccounts.map((a) => a.id),
    categories,
  });
  if (!reply) {
    console.error('[marx] resposta fora do formato esperado');
    return NextResponse.json({ ok: false, error: CONFUSED }, { status: 422 });
  }

  return NextResponse.json({ ok: true, data: reply });
}

export async function GET() {
  return NextResponse.json({ ok: false, error: 'Método não permitido. Use POST.' }, { status: 405 });
}
