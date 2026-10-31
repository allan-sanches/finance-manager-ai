// Lê nome, preço e foto de uma página de produto. Lojas brasileiras quase sempre publicam os dados em
// JSON-LD (schema.org/Product) para o Google Shopping; quando não, sobram as meta tags de produto.

export type ProductInfo = {
  name: string | null;
  price: number | null;
  imageUrl: string | null; // sempre https absoluto
};

/** "1.299,90", "1299.90", "R$ 1.299", 1299.9 → número. null se não parecer preço. */
export function parsePrice(raw: unknown): number | null {
  if (typeof raw === 'number') return Number.isFinite(raw) && raw > 0 ? round2(raw) : null;
  if (typeof raw !== 'string') return null;
  let s = raw.replace(/[^\d.,]/g, '');
  if (!s) return null;
  const lastComma = s.lastIndexOf(',');
  const lastDot = s.lastIndexOf('.');
  if (lastComma > lastDot) {
    s = s.replace(/\./g, '').replace(',', '.'); // 1.299,90
  } else if (lastDot > lastComma && lastComma !== -1) {
    s = s.replace(/,/g, ''); // 1,299.90
  } else if (lastDot !== -1 && s.length - lastDot - 1 === 3 && s.indexOf('.') === lastDot) {
    // "1.299" sem centavos: ponto de milhar no padrão brasileiro.
    s = s.replace('.', '');
  }
  const n = Number(s);
  return Number.isFinite(n) && n > 0 ? round2(n) : null;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

export function extractProductInfo(html: string, pageUrl: string): ProductInfo {
  const fromLd = productFromJsonLd(html);
  const meta = readMeta(html);

  const price =
    fromLd.price ??
    parsePrice(meta['product:price:amount'] ?? meta['og:price:amount']) ??
    parsePrice(itempropPrice(html));

  const name = cleanText(fromLd.name ?? meta['og:title'] ?? titleTag(html));
  const imageUrl = toHttpsUrl(fromLd.image ?? meta['og:image:secure_url'] ?? meta['og:image'], pageUrl);

  return { name, price, imageUrl };
}

type LdProduct = { name: string | null; price: number | null; image: string | null };

function productFromJsonLd(html: string): LdProduct {
  const result: LdProduct = { name: null, price: null, image: null };
  const blocks = html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi);
  for (const [, body] of blocks) {
    const data = parseJson(body.trim());
    if (data === undefined) continue;
    for (const node of walk(data)) {
      if (!isType(node, 'Product')) continue;
      result.name ??= typeof node.name === 'string' ? node.name : null;
      result.image ??= firstImage(node.image);
      result.price ??= offerPrice(node.offers);
      if (result.price !== null) return result;
    }
  }
  return result;
}

// Conteúdo de <script> não leva entidades HTML, mas algumas lojas escapam assim mesmo.
function parseJson(text: string): unknown {
  for (const candidate of [text, decodeEntities(text)]) {
    try {
      return JSON.parse(candidate);
    } catch {
      // tenta a próxima forma
    }
  }
  return undefined;
}

type Node = Record<string, unknown>;

function* walk(value: unknown, depth = 0): Generator<Node> {
  if (depth > 6 || value === null || typeof value !== 'object') return;
  if (Array.isArray(value)) {
    for (const v of value) yield* walk(v, depth + 1);
    return;
  }
  const node = value as Node;
  yield node;
  if (node['@graph']) yield* walk(node['@graph'], depth + 1);
  if (node.mainEntity) yield* walk(node.mainEntity, depth + 1);
}

function isType(node: Node, type: string): boolean {
  const t = node['@type'];
  return t === type || (Array.isArray(t) && t.includes(type));
}

function offerPrice(offers: unknown): number | null {
  const prices: number[] = [];
  for (const offer of walkOffers(offers)) {
    const currency = offer.priceCurrency;
    if (typeof currency === 'string' && currency.toUpperCase() !== 'BRL') continue;
    const spec = offer.priceSpecification as Node | undefined;
    const price = parsePrice(offer.price) ?? parsePrice(offer.lowPrice) ?? parsePrice(spec?.price);
    if (price !== null) prices.push(price);
  }
  return prices.length ? Math.min(...prices) : null;
}

function* walkOffers(offers: unknown, depth = 0): Generator<Node> {
  if (depth > 3 || offers === null || typeof offers !== 'object') return;
  if (Array.isArray(offers)) {
    for (const o of offers) yield* walkOffers(o, depth + 1);
    return;
  }
  const node = offers as Node;
  yield node;
  if (node.offers) yield* walkOffers(node.offers, depth + 1); // AggregateOffer com ofertas dentro
}

function firstImage(image: unknown): string | null {
  if (typeof image === 'string') return image;
  if (Array.isArray(image)) return firstImage(image[0]);
  if (image && typeof image === 'object') {
    const url = (image as Node).url ?? (image as Node).contentUrl;
    return typeof url === 'string' ? url : null;
  }
  return null;
}

function readMeta(html: string): Record<string, string> {
  const meta: Record<string, string> = {};
  for (const [tag] of html.matchAll(/<meta\b[^>]*>/gi)) {
    const key = attr(tag, 'property') ?? attr(tag, 'name') ?? attr(tag, 'itemprop');
    const content = attr(tag, 'content');
    if (key && content && !(key.toLowerCase() in meta)) meta[key.toLowerCase()] = decodeEntities(content);
  }
  return meta;
}

function itempropPrice(html: string): string | null {
  const tag = html.match(/<[^>]+itemprop=["']price["'][^>]*>/i)?.[0];
  return tag ? (attr(tag, 'content') ?? null) : null;
}

function attr(tag: string, name: string): string | null {
  const m = tag.match(new RegExp(`\\b${name}\\s*=\\s*("([^"]*)"|'([^']*)')`, 'i'));
  return m ? (m[2] ?? m[3] ?? null) : null;
}

function titleTag(html: string): string | null {
  return html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? null;
}

function cleanText(text: string | null): string | null {
  if (!text) return null;
  const clean = decodeEntities(text).replace(/\s+/g, ' ').trim().slice(0, 200);
  return clean || null;
}

function toHttpsUrl(raw: string | null | undefined, base: string): string | null {
  if (!raw) return null;
  try {
    const url = new URL(decodeEntities(raw.trim()), base);
    if (url.protocol === 'http:') url.protocol = 'https:';
    return url.protocol === 'https:' && url.href.length <= 2000 ? url.href : null;
  } catch {
    return null;
  }
}

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };

function decodeEntities(s: string): string {
  return s.replace(/&(#x[\da-f]+|#\d+|[a-z]+);/gi, (whole, code: string) => {
    if (code[0] === '#') {
      const n = code[1].toLowerCase() === 'x' ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
      return Number.isFinite(n) && n > 0 && n < 0x110000 ? String.fromCodePoint(n) : whole;
    }
    return ENTITIES[code.toLowerCase()] ?? whole;
  });
}
