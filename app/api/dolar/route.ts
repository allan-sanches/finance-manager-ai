import { NextResponse } from 'next/server';
import { z } from 'zod';

// Cotação do dólar para mostrar as caixinhas em dólar convertidas para real.
// Série SGS 1 do Banco Central: dólar comercial (PTAX venda), um valor por dia útil.
const SGS_URL = 'https://api.bcb.gov.br/dados/serie/bcdata.sgs.1/dados/ultimos/1?formato=json';
const CACHE_SECONDS = 6 * 60 * 60;

const usdSchema = z
  .array(z.object({ data: z.string(), valor: z.string() }))
  .min(1)
  .transform(([row]) => ({ date: row.data, rate: Number(row.valor.replace(',', '.')) }))
  .refine((r) => Number.isFinite(r.rate) && r.rate > 0 && r.rate < 100);

export async function GET() {
  try {
    const response = await fetch(SGS_URL, {
      next: { revalidate: CACHE_SECONDS },
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const parsed = usdSchema.safeParse(await response.json());
    if (!parsed.success) throw new Error('resposta fora do formato esperado');
    return NextResponse.json(
      { ok: true, data: parsed.data },
      { headers: { 'Cache-Control': `private, max-age=${CACHE_SECONDS}` } },
    );
  } catch (err) {
    console.error('[dolar] falha ao consultar o Banco Central', err);
    return NextResponse.json({ ok: false, error: 'Cotação do dólar indisponível no momento.' }, { status: 502 });
  }
}
