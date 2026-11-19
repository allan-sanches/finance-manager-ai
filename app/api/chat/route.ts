import { NextResponse } from 'next/server';

import {
  extractTransactionFromText,
  resolveAiProvider,
  type ExtractionErrorCode,
} from '@/lib/ai';
import { AI_PROVIDER_COOKIE } from '@/lib/ai-provider';
import { getSessionUserId } from '@/lib/auth';
import { userCategoryNames } from '@/lib/categories-server';
import { chatRequestSchema } from '@/lib/chat-schemas';
import { createRateLimiter } from '@/lib/rate-limit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const checkRateLimit = createRateLimiter({ limit: 10, windowMs: 60_000 });

const STATUS_BY_ERROR: Record<ExtractionErrorCode, number> = {
  not_configured: 503,
  invalid_output: 422,
  upstream_error: 502,
};

export async function POST(request: Request) {
  // O proxy só confere a assinatura; aqui vale também a versão (senha trocada derruba a sessão).
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ ok: false, error: 'Não autenticado.' }, { status: 401 });
  }

  // Por conta, não por IP: o X-Forwarded-For vem do cliente, e trocar o header daria limite novo.
  const rate = checkRateLimit(userId);
  if (!rate.allowed) {
    return NextResponse.json(
      { ok: false, error: 'Muitas requisições. Aguarde um pouco e tente de novo.' },
      { status: 429, headers: { 'Retry-After': String(rate.retryAfterSeconds) } },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: 'Payload inválido (JSON malformado).' },
      { status: 400 },
    );
  }

  const parsed = chatRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: parsed.error.issues[0]?.message ?? 'Payload inválido.' },
      { status: 400 },
    );
  }

  const provider = resolveAiProvider(readCookie(request, AI_PROVIDER_COOKIE));
  const result = await extractTransactionFromText(
    provider,
    parsed.data.message,
    parsed.data.creditCards,
    await userCategoryNames(),
  );
  if (!result.ok) {
    return NextResponse.json(
      { ok: false, error: result.error },
      { status: STATUS_BY_ERROR[result.code] },
    );
  }

  return NextResponse.json({ ok: true, data: result.data }, { status: 200 });
}

function readCookie(request: Request, name: string): string | undefined {
  for (const part of request.headers.get('cookie')?.split(';') ?? []) {
    const [key, ...value] = part.trim().split('=');
    if (key === name) return value.join('=');
  }
  return undefined;
}

export async function GET() {
  return NextResponse.json(
    { ok: false, error: 'Método não permitido. Use POST.' },
    { status: 405 },
  );
}
