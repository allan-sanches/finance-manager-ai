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

// A AwesomeAPI devolve 429 para IPs compartilhados (ex.: Railway) e resposta de erro não fica no
// cache do fetch: depois de uma falha, ela fica de lado por um tempo e o Banco Central cobre dólar e euro.
const AWESOME_BACKOFF_MS = 10 * 60_000;
let awesomeBlockedUntil = 0;

async function awesomeCurrencies(): Promise<Quote[] | null> {
  if (Date.now() < awesomeBlockedUntil) return null;
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
    awesomeBlockedUntil = Date.now() + AWESOME_BACKOFF_MS;
    console.error('[marx] AwesomeAPI indisponível; usando o Banco Central', err);
    return null;
  }
}

/** PTAX de venda do Banco Central (SGS 1 = dólar, 21619 = euro): sem variação do dia nem bitcoin. */
async function centralBankCurrencies(): Promise<Quote[]> {
  const [usd, eur] = await Promise.all([sgs(1), sgs(21619)]);
  const quotes: Quote[] = [];
  if (usd) quotes.push({ name: 'Dólar Americano/Real Brasileiro (PTAX)', brl: usd.rate, changePercent: null, updatedAt: usd.date });
  if (eur) quotes.push({ name: 'Euro/Real Brasileiro (PTAX)', brl: eur.rate, changePercent: null, updatedAt: eur.date });
  return quotes;
}

async function currencies(): Promise<Quote[]> {
  return (await awesomeCurrencies()) ?? centralBankCurrencies();
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

/** CDI anual (% a.a., base 252) do Banco Central, com cache: usado no rendimento diário (lib/accrual.ts). */
export async function getCdiAnnualRate(): Promise<number | null> {
  return (await sgs(4389))?.rate ?? null;
}

export async function getMarketQuotes(): Promise<MarketQuotes> {
  const [fx, cdiAnnual, selicTarget] = await Promise.all([currencies(), sgs(4389), sgs(432)]);
  return { currencies: fx, cdiAnnual, selicTarget };
}
