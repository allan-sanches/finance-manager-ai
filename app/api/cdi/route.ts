import { NextResponse } from 'next/server';
import { z } from 'zod';

// CDI anualizado (base 252) da API pública do Banco Central — série SGS 4389. Usado só para
// estimar o rendimento das caixinhas; muda no máximo uma vez por dia útil, então fica em cache.
const SGS_URL = 'https://api.bcb.gov.br/dados/serie/bcdata.sgs.4389/dados/ultimos/1?formato=json';
const CACHE_SECONDS = 6 * 60 * 60;

const responseSchema = z
  .array(z.object({ data: z.string(), valor: z.string() }))
  .min(1)
  .transform(([row]) => ({ date: row.data, annualRate: Number(row.valor.replace(',', '.')) }))
  .refine((r) => Number.isFinite(r.annualRate) && r.annualRate > 0 && r.annualRate < 100);

export async function GET() {
  try {
    const response = await fetch(SGS_URL, {
      next: { revalidate: CACHE_SECONDS },
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const parsed = responseSchema.safeParse(await response.json());
    if (!parsed.success) throw new Error('resposta fora do formato esperado');
    return NextResponse.json(
      { ok: true, data: parsed.data },
      { headers: { 'Cache-Control': `private, max-age=${CACHE_SECONDS}` } },
    );
  } catch (err) {
    console.error('[cdi] falha ao consultar o Banco Central', err);
    return NextResponse.json({ ok: false, error: 'CDI indisponível no momento.' }, { status: 502 });
  }
}
