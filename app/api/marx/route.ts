import { NextResponse } from 'next/server';

import type { ExtractionErrorCode } from '@/lib/ai';
import { chatJsonWithGateway } from '@/lib/ai-gateway';
import { getSessionUserId } from '@/lib/auth';
import { getDb } from '@/lib/db';
import { getBankSnapshot } from '@/lib/bank-snapshot';
import { mergeCategoryNames, todayISO } from '@/lib/finance';
import { findDuplicateEntries } from '@/lib/import/dedupe';
import { buildFinanceContext } from '@/lib/marx/context';
import { buildMarxSystemPrompt, MARX_RESPONSE_SCHEMA, toChatMessages } from '@/lib/marx/prompt';
import { resolveMarxModel } from '@/lib/marx/models';
import { getMarketQuotes } from '@/lib/marx/quotes';
import { marxRequestSchema, parseMarxReply } from '@/lib/marx/schemas';
import { clientKeyFromRequest, createRateLimiter } from '@/lib/rate-limit';

// Assistente Marx: conversa com o DeepSeek (via Vercel AI Gateway) sobre os dados do usuário logado. Os dados saem do
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
  'O Marx está indisponível: falta configurar a AI_GATEWAY_API_KEY no servidor.';
const CONFUSED = 'Não consegui formular uma resposta. Reformule a pergunta, por favor.';

export async function POST(request: Request) {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ ok: false, error: 'Não autenticado.' }, { status: 401 });
  }

  const rate = checkRateLimit(`marx:${userId}:${clientKeyFromRequest(request)}`);
  if (!rate.allowed) {
    return NextResponse.json(
      { ok: false, error: 'Muitas mensagens seguidas. Aguarde um instante antes de continuar.' },
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

  const [snapshot, quotes] = await Promise.all([getBankSnapshot(getDb(), userId), getMarketQuotes()]);
  const today = todayISO();
  const categories = mergeCategoryNames(snapshot.categories);
  const system = buildMarxSystemPrompt({
    today,
    categories,
    financeContext: buildFinanceContext(snapshot, quotes, today),
  });

  const model = resolveMarxModel(parsed.data.model);
  const result = await chatJsonWithGateway(
    model,
    toChatMessages(system, parsed.data.messages),
    MARX_RESPONSE_SCHEMA,
  );
  if (!result.ok) {
    const error = result.code === 'not_configured' ? NOT_CONFIGURED : result.code === 'invalid_output' ? CONFUSED : result.error;
    return NextResponse.json({ ok: false, error }, { status: STATUS_BY_ERROR[result.code] });
  }

  const reply = parseMarxReply(result.value, {
    cardIds: snapshot.creditCards.map((c) => c.id),
    accountIds: snapshot.bankAccounts.map((a) => a.id),
    categories,
    goalIds: snapshot.savingsGoals.map((g) => g.id),
  });
  if (!reply) {
    console.error('[marx] resposta fora do formato esperado');
    return NextResponse.json({ ok: false, error: CONFUSED }, { status: 422 });
  }

  // O Marx só vê os lançamentos recentes; aqui a conferência é com todos (mesma regra do extrato:
  // mesmo tipo e valor, até 1 dia de diferença). O repetido chega desmarcado e a resposta avisa.
  const duplicates = [...findDuplicateEntries(reply.transactions, snapshot.transactions)].sort((a, b) => a - b);
  if (duplicates.length > 0) {
    reply.duplicates = duplicates;
    const all = duplicates.length === reply.transactions.length;
    reply.reply +=
      duplicates.length === 1
        ? `\n\n${all ? 'Esse lançamento já está' : 'Um desses lançamentos já está'} no app (provavelmente veio do extrato) e ficou desmarcado.`
        : `\n\n${all ? 'Esses lançamentos já estão' : `${duplicates.length} desses lançamentos já estão`} no app (provavelmente vieram do extrato) e ficaram desmarcados.`;
  }

  return NextResponse.json({ ok: true, data: reply, model });
}

export async function GET() {
  return NextResponse.json({ ok: false, error: 'Método não permitido. Use POST.' }, { status: 405 });
}
