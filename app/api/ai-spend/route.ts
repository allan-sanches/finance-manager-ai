import { NextResponse } from 'next/server';

import { recentAiSpend } from '@/lib/ai-spend';
import { isAiSpendAuthorized } from '@/lib/ai-spend-token';

// Quanto o app gastou com IA nos últimos 35 dias, por dia e por modelo. Quem lê é o painel do dono
// do app, de fora, sem sessão: por isso a rota é pública no proxy e quem protege é o Bearer
// (AI_SPEND_TOKEN, 32 caracteres ou mais). Sem a variável, a rota não existe (404).
// Só leitura e só somas do app inteiro: nenhum dado de usuário, pedido ou resposta da IA.

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const DAYS = 35;

export async function GET(request: Request) {
  const expected = process.env.AI_SPEND_TOKEN;
  if (!expected) return NextResponse.json({ ok: false, error: 'Não encontrado.' }, { status: 404 });
  if (!isAiSpendAuthorized(request.headers.get('authorization'), expected)) {
    return NextResponse.json({ ok: false, error: 'Não autorizado.' }, { status: 401 });
  }
  try {
    const days = await recentAiSpend(DAYS);
    return NextResponse.json(
      { ok: true, app: 'finance-manager-ai', currency: 'USD', days },
      { headers: { 'cache-control': 'no-store' } },
    );
  } catch (err) {
    console.error('[ai-spend] read failed', err instanceof Error ? err.message : err);
    return NextResponse.json({ ok: false, error: 'Não foi possível ler o gasto agora.' }, { status: 503 });
  }
}
