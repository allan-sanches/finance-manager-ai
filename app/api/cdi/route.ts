import { NextResponse } from 'next/server';
import { z } from 'zod';

// Dados públicos do Banco Central para projetar as caixinhas; mudam no máximo uma vez por dia útil,
// então ficam em cache.
// - CDI anualizado (base 252): série SGS 4389.
// - Selic esperada para o fim de cada ano: mediana do boletim Focus (API Olinda de Expectativas).
const SGS_URL = 'https://api.bcb.gov.br/dados/serie/bcdata.sgs.4389/dados/ultimos/1?formato=json';
const FOCUS_URL =
  'https://olinda.bcb.gov.br/olinda/servico/Expectativas/versao/v1/odata/ExpectativasMercadoAnuais' +
  "?$top=20&$filter=Indicador%20eq%20'Selic'%20and%20baseCalculo%20eq%200" +
  '&$orderby=Data%20desc&$format=json&$select=Data,DataReferencia,Mediana';
const CACHE_SECONDS = 6 * 60 * 60;

const cdiSchema = z
  .array(z.object({ data: z.string(), valor: z.string() }))
  .min(1)
  .transform(([row]) => ({ date: row.data, annualRate: Number(row.valor.replace(',', '.')) }))
  .refine((r) => Number.isFinite(r.annualRate) && r.annualRate > 0 && r.annualRate < 100);

const focusSchema = z.object({
  value: z.array(
    z.object({ Data: z.string(), DataReferencia: z.string(), Mediana: z.number().gt(0).lt(100) }),
  ),
});

async function getJson(url: string): Promise<unknown> {
  const response = await fetch(url, {
    next: { revalidate: CACHE_SECONDS },
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}

/** Só o boletim mais recente; uma linha por ano de referência. */
async function getSelicOutlook() {
  try {
    const parsed = focusSchema.safeParse(await getJson(FOCUS_URL));
    if (!parsed.success || parsed.data.value.length === 0) throw new Error('resposta fora do formato esperado');
    const latest = parsed.data.value[0].Data;
    const rows = parsed.data.value.filter((r) => r.Data === latest);
    return {
      outlookDate: latest,
      selicOutlook: rows
        .map((r) => ({ year: Number(r.DataReferencia), rate: r.Mediana }))
        .filter((r) => Number.isInteger(r.year))
        .sort((a, b) => a.year - b.year),
    };
  } catch (err) {
    // Sem Focus a projeção cai para CDI constante; não derruba o CDI.
    console.error('[cdi] falha ao consultar o Focus', err);
    return { outlookDate: null, selicOutlook: [] };
  }
}

export async function GET() {
  try {
    const [cdiJson, outlook] = await Promise.all([getJson(SGS_URL), getSelicOutlook()]);
    const parsed = cdiSchema.safeParse(cdiJson);
    if (!parsed.success) throw new Error('resposta fora do formato esperado');
    return NextResponse.json(
      { ok: true, data: { ...parsed.data, ...outlook } },
      { headers: { 'Cache-Control': `private, max-age=${CACHE_SECONDS}` } },
    );
  } catch (err) {
    console.error('[cdi] falha ao consultar o Banco Central', err);
    return NextResponse.json({ ok: false, error: 'CDI indisponível no momento.' }, { status: 502 });
  }
}
