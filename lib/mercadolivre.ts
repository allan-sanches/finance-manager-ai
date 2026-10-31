import 'server-only';

import type { ProductInfo } from '@/lib/product-page';

// Mercado Livre pela API oficial. A página do produto pede verificação de conta para acessos
// automáticos, então o preço vem da API com o token do próprio app (Client Credentials): basta
// criar um app em developers.mercadolivre.com.br e definir MERCADOLIVRE_CLIENT_ID/SECRET.
// Esse token lê o catálogo público (links /p/MLB…); anúncios avulsos podem ser recusados.
// Docs: https://developers.mercadolivre.com.br/pt_br/autenticacao-e-autorizacao

const API_BASE = 'https://api.mercadolibre.com';
const TIMEOUT_MS = 15_000;

export class MercadoLivreError extends Error {}

export function mercadolivreConfigured(): boolean {
  return Boolean(process.env.MERCADOLIVRE_CLIENT_ID && process.env.MERCADOLIVRE_CLIENT_SECRET);
}

export type MlIds = { productId: string | null; itemId: string | null };

/** IDs consultáveis na API a partir de um link do ML; null se não for link do ML. */
export function parseMercadoLivreUrl(raw: string): MlIds | null {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  if (!/(^|\.)mercadoli(vre|bre)\./i.test(url.hostname)) return null;
  const productId = url.pathname.match(/\/p\/(MLB\d+)/i)?.[1]?.toUpperCase() ?? null;
  const isUserProduct = /\/up\/MLBU\d+/i.test(url.pathname);
  // O anúncio clicado vem em `wid`, às vezes no fragmento (#…&wid=MLB…).
  const wid = url.searchParams.get('wid') ?? new URLSearchParams(url.hash.slice(1)).get('wid');
  const pathItem = !productId && !isUserProduct ? url.pathname.match(/\bMLB-?(\d{6,})/i) : null;
  const itemId = wid && /^MLB\d+$/i.test(wid) ? wid.toUpperCase() : pathItem ? `MLB${pathItem[1]}` : null;
  if (!productId && !itemId) return null;
  return { productId, itemId };
}

// Token do app guardado em memória até perto de vencer (vale ~6h).
const globalForMl = globalThis as unknown as { mlAppToken?: { token: string; exp: number } };

async function appToken(): Promise<string> {
  const cached = globalForMl.mlAppToken;
  if (cached && cached.exp - Date.now() > 5 * 60_000) return cached.token;
  const res = await fetch(`${API_BASE}/oauth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: process.env.MERCADOLIVRE_CLIENT_ID ?? '',
      client_secret: process.env.MERCADOLIVRE_CLIENT_SECRET ?? '',
    }),
    cache: 'no-store',
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  const data = (await res.json().catch(() => ({}))) as { access_token?: string; expires_in?: number };
  if (!res.ok || !data.access_token) {
    console.error('[mercadolivre] token recusado', res.status);
    throw new MercadoLivreError('Não consegui autenticar no Mercado Livre (confira o app configurado).');
  }
  globalForMl.mlAppToken = { token: data.access_token, exp: Date.now() + (data.expires_in ?? 21_600) * 1000 };
  return data.access_token;
}

async function api<T>(path: string, params: Record<string, string | number> = {}): Promise<T | null> {
  const url = new URL(`${API_BASE}${path}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, String(v));
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${await appToken()}`, Accept: 'application/json' },
      cache: 'no-store',
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (res.status === 429 && attempt < 2) {
      await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)));
      continue;
    }
    if (res.status === 401) globalForMl.mlAppToken = undefined;
    if (res.status === 404) return null;
    if (res.status === 401 || res.status === 403) {
      throw new MercadoLivreError(
        'A API do Mercado Livre não libera este anúncio. Use o link do produto de catálogo (com /p/MLB…).',
      );
    }
    if (!res.ok) throw new MercadoLivreError(`O Mercado Livre respondeu ${res.status}.`);
    return (await res.json()) as T;
  }
}

type Picture = { url?: string; secure_url?: string };
type Offer = { price?: number | null; condition?: string };

const toNumber = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : null);
const pictureOf = (pics?: Picture[]) =>
  pics?.[0]?.secure_url ?? pics?.[0]?.url?.replace(/^http:/, 'https:') ?? null;

/** Todas as ofertas ativas de um produto de catálogo (a API pagina de 100 em 100). */
async function productOffers(productId: string): Promise<Offer[]> {
  const out: Offer[] = [];
  for (let offset = 0; offset < 1_000; offset += 100) {
    const page = await api<{ results?: Offer[]; paging?: { total?: number } }>(`/products/${productId}/items`, {
      limit: 100,
      offset,
    });
    const results = page?.results ?? [];
    out.push(...results);
    if (results.length < 100 || out.length >= (page?.paging?.total ?? 0)) break;
  }
  return out;
}

/**
 * Nome, preço e foto pela API.
 * - Produto de catálogo (/p/MLB…): menor preço entre as ofertas novas (o preço cheio; a página às
 *   vezes mostra um valor menor no Pix).
 * - Anúncio avulso: o preço dele, se a API liberar com o token do app.
 */
export async function mercadolivreProduct(ids: MlIds): Promise<ProductInfo> {
  if (ids.productId) {
    const product = await api<{ name?: string; pictures?: Picture[] }>(`/products/${ids.productId}`);
    if (!product) throw new MercadoLivreError('Produto não encontrado no catálogo do Mercado Livre.');
    const offers = (await productOffers(ids.productId)).filter((o) => toNumber(o.price));
    const fresh = offers.filter((o) => !o.condition || o.condition === 'new');
    const pool = fresh.length ? fresh : offers;
    return {
      name: product.name?.trim() || null,
      price: pool.length ? Math.min(...pool.map((o) => o.price as number)) : null,
      imageUrl: pictureOf(product.pictures),
    };
  }

  const item = await api<{ id: string; title?: string; price?: number | null; pictures?: Picture[]; thumbnail?: string }>(
    `/items/${ids.itemId}`,
  );
  if (!item) throw new MercadoLivreError('Anúncio não encontrado no Mercado Livre.');
  // Preço que o comprador paga hoje (com promoção); o `price` do anúncio fica de reserva.
  const sale = await api<{ amount?: number | null }>(`/items/${item.id}/sale_price`, {
    context: 'channel_marketplace',
  }).catch(() => null);
  return {
    name: item.title?.trim() || null,
    price: toNumber(sale?.amount) ?? toNumber(item.price),
    imageUrl: pictureOf(item.pictures) ?? item.thumbnail?.replace(/^http:/, 'https:') ?? null,
  };
}
