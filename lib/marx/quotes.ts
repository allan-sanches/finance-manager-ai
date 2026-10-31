import 'server-only';

import { z } from 'zod';

// Cotações para o Marx conversar sobre o mercado. A IA não tem internet: o que ela sabe de
// câmbio e juros é só o que vai aqui. Cada fonte falha sozinha, sem derrubar a conversa.
// - Moedas e bitcoin: AwesomeAPI (pública, atualiza ao longo do dia).
// - CDI (SGS 4389) e meta Selic (SGS 432): Banco Central, uma vez por dia útil.

const AWESOME_URL = 'https://economia.awesomeapi.com.br/json/last/USD-BRL,EUR-BRL,BTC-BRL';
const sgsUrl = (series: number) =>
  `https://api.bcb.gov.br/dados/serie/bcdata.sgs.${series}/dados/ultimos/1?formato=json`;

const FX_CACHE_SECONDS = 15 * 60;
const RATES_CACHE_SECONDS = 6 * 60 * 60;

export type Quote = { name: string; brl: number; changePercent: number | null; updatedAt: string };

export type MarketQuotes = {
  currencies: Quote[];
  cdiAnnual: { rate: number; date: string } | null;
  selicTarget: { rate: number; date: string } | null;
};

const awesomeSchema = z.record(
  z.string(),
  z.object({
    name: z.string(),
    bid: z.coerce.number().positive(),
    pctChange: z.coerce.number().optional(),
    create_date: z.string(),
  }),
);

const sgsSchema = z
  .array(z.object({ data: z.string(), valor: z.string() }))
  .min(1)
  .transform(([row]) => ({ date: row.data, rate: Number(row.valor.replace(',', '.')) }))
  .refine((r) => Number.isFinite(r.rate) && r.rate > 0 && r.rate < 100);

async function getJson(url: string, revalidate: number): Promise<unknown> {
  const response = await fetch(url, { next: { revalidate }, signal: AbortSignal.timeout(8_000) });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}

async function currencies(): Promise<Quote[]> {
  try {
    const parsed = awesomeSchema.safeParse(await getJson(AWESOME_URL, FX_CACHE_SECONDS));
    if (!parsed.success) throw new Error('resposta fora do formato esperado');
    return Object.values(parsed.data).map((q) => ({
      name: q.name,
      brl: q.bid,
      changePercent: q.pctChange ?? null,
      updatedAt: q.create_date,
    }));
  } catch (err) {
    console.error('[marx] cotações de moedas indisponíveis', err);
    return [];
  }
}

async function sgs(series: number): Promise<{ rate: number; date: string } | null> {
  try {
    const parsed = sgsSchema.safeParse(await getJson(sgsUrl(series), RATES_CACHE_SECONDS));
    if (!parsed.success) throw new Error('resposta fora do formato esperado');
    return parsed.data;
  } catch (err) {
    console.error(`[marx] série ${series} do Banco Central indisponível`, err);
    return null;
  }
}

export async function getMarketQuotes(): Promise<MarketQuotes> {
  const [fx, cdiAnnual, selicTarget] = await Promise.all([currencies(), sgs(4389), sgs(432)]);
  return { currencies: fx, cdiAnnual, selicTarget };
}
