import type { PricePoint, ShoppingItem } from '@/types/finance';

/** Pontos guardados por item: um ano de leituras diárias. */
export const MAX_PRICE_POINTS = 365;

/**
 * Anota um preço no histórico, em ordem de data. Um dia que já tem preço é substituído (corrigir um
 * valor digitado errado não vira "variação"). Anotação manual com o mesmo preço do último não cria
 * ponto; a leitura automática (`daily`) cria um por dia, para o gráfico mostrar o preço ao longo do tempo.
 */
export function withPrice(
  history: ReadonlyArray<PricePoint>,
  price: number,
  date: string,
  { daily = false }: { daily?: boolean } = {},
): PricePoint[] {
  const others = history.filter((p) => p.date !== date);
  const last = others.at(-1);
  if (!daily && others.length === history.length && last && last.date < date && last.price === price) {
    return [...history];
  }
  return [...others, { date, price }].sort((a, b) => a.date.localeCompare(b.date)).slice(-MAX_PRICE_POINTS);
}

/** Preço atual = o anotado mais recente. */
export const latestPrice = (history: ReadonlyArray<PricePoint>): number | null => history.at(-1)?.price ?? null;

export type PriceTrend = {
  current: number;
  /** Variação contra o último preço diferente do atual (negativo = ficou mais barato). */
  change: number;
  changePercent: number;
  lowest: number;
  highest: number;
  /** O preço atual é o menor já anotado (e já houve um preço maior). */
  isLowest: boolean;
  points: number;
};

/** Sem preço atual não há tendência, mesmo com histórico (o usuário apagou o preço). */
export function priceTrend(item: Pick<ShoppingItem, 'estimatedPrice' | 'priceHistory'>): PriceTrend | null {
  if (item.estimatedPrice == null) return null;
  const history = item.priceHistory?.length
    ? item.priceHistory
    : [{ date: '', price: item.estimatedPrice }];
  const last = history.at(-1);
  if (!last) return null;
  // Compara com o último preço diferente: leituras diárias repetem o mesmo valor.
  const previous = history.findLast((p) => p.price !== last.price);
  const prices = history.map((p) => p.price);
  const lowest = Math.min(...prices);
  const highest = Math.max(...prices);
  const change = previous ? last.price - previous.price : 0;
  return {
    current: last.price,
    change,
    changePercent: previous && previous.price > 0 ? (change / previous.price) * 100 : 0,
    lowest,
    highest,
    isLowest: highest > lowest && last.price === lowest,
    points: history.length,
  };
}

const PRIORITY_ORDER = { high: 0, medium: 1, low: 2 } as const;

/** Prioridade alta primeiro; empate fica com o mais recente (ordem que já vem do servidor). */
export function sortWishes<T extends Pick<ShoppingItem, 'priority'>>(items: ReadonlyArray<T>): T[] {
  return [...items].sort(
    (a, b) => PRIORITY_ORDER[a.priority ?? 'medium'] - PRIORITY_ORDER[b.priority ?? 'medium'],
  );
}

/** "agora há pouco", "há 3 h", "há 2 dias" — quando o preço foi lido na loja pela última vez. */
export function checkedAgo(checkedAt: string, now: Date = new Date()): string {
  const minutes = Math.max(0, Math.floor((now.getTime() - new Date(checkedAt).getTime()) / 60_000));
  if (minutes < 60) return 'agora há pouco';
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `há ${hours} h`;
  const days = Math.floor(hours / 24);
  return days === 1 ? 'há 1 dia' : `há ${days} dias`;
}
