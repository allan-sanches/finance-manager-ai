import { NextResponse } from 'next/server';

import { getDb } from '@/lib/db';
import * as repo from '@/lib/db/repository';
import { isPriceWatchAuthorized } from '@/lib/price-watch-secret';
import { checkWishPrices, PRICE_CHECK_INTERVAL_MS } from '@/lib/price-watch';

// Rotina de acompanhamento de preço: lê de novo os desejos de todas as contas que não são lidos há
// mais de 6h. Chamada pelo instrumentation.ts a cada 6h (ou por um agendador externo com CRON_SECRET).
// Pública no proxy; quem protege é o Bearer.

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export async function POST(request: Request) {
  if (!isPriceWatchAuthorized(request.headers.get('authorization'))) {
    return NextResponse.json({ ok: false, error: 'Não autorizado.' }, { status: 401 });
  }
  const db = getDb();
  const wishes = await repo.listWishesToCheck(db, {
    staleBefore: new Date(Date.now() - PRICE_CHECK_INTERVAL_MS),
  });
  const updated = await checkWishPrices(db, wishes);
  return NextResponse.json({ ok: true, checked: wishes.length, updated });
}
