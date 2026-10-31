import { describe, expect, it } from 'vitest';

import { checkedAgo, priceTrend, sortWishes, withPrice } from '@/lib/wishlist';

describe('withPrice', () => {
  it('adiciona um ponto por dia', () => {
    expect(withPrice([{ date: '2026-10-01', price: 100 }], 90, '2026-10-05')).toEqual([
      { date: '2026-10-01', price: 100 },
      { date: '2026-10-05', price: 90 },
    ]);
  });

  it('no mesmo dia substitui o último preço', () => {
    expect(withPrice([{ date: '2026-10-05', price: 100 }], 95, '2026-10-05')).toEqual([
      { date: '2026-10-05', price: 95 },
    ]);
  });

  it('preço de um dia antigo entra na ordem', () => {
    expect(
      withPrice(
        [
          { date: '2026-10-01', price: 100 },
          { date: '2026-10-09', price: 80 },
        ],
        90,
        '2026-10-05',
      ).map((p) => p.date),
    ).toEqual(['2026-10-01', '2026-10-05', '2026-10-09']);
  });

  it('preço repetido não cria ponto', () => {
    const history = [{ date: '2026-10-01', price: 100 }];
    expect(withPrice(history, 100, '2026-10-09')).toEqual(history);
  });

  it('leitura automática cria um ponto por dia mesmo sem mudar o preço', () => {
    expect(withPrice([{ date: '2026-10-01', price: 100 }], 100, '2026-10-02', { daily: true })).toHaveLength(2);
  });

  it('guarda no máximo um ano de pontos', () => {
    const history = Array.from({ length: 365 }, (_, i) => ({
      date: new Date(Date.UTC(2025, 0, 1 + i)).toISOString().slice(0, 10),
      price: 100,
    }));
    const next = withPrice(history, 90, '2026-10-31', { daily: true });
    expect(next).toHaveLength(365);
    expect(next.at(-1)).toEqual({ date: '2026-10-31', price: 90 });
    expect(next[0].date).toBe('2025-01-02');
  });
});

describe('priceTrend', () => {
  it('compara com o preço anterior e marca o menor', () => {
    const trend = priceTrend({
      estimatedPrice: 80,
      priceHistory: [
        { date: '2026-09-01', price: 120 },
        { date: '2026-09-15', price: 100 },
        { date: '2026-10-01', price: 80 },
      ],
    });
    expect(trend).toMatchObject({ current: 80, change: -20, lowest: 80, highest: 120, isLowest: true });
    expect(trend?.changePercent).toBeCloseTo(-20);
  });

  it('leituras repetidas não escondem a última mudança', () => {
    const trend = priceTrend({
      estimatedPrice: 90,
      priceHistory: [
        { date: '2026-10-01', price: 100 },
        { date: '2026-10-02', price: 90 },
        { date: '2026-10-03', price: 90 },
      ],
    });
    expect(trend).toMatchObject({ change: -10, isLowest: true });
  });

  it('item sem histórico usa o preço estimado', () => {
    expect(priceTrend({ estimatedPrice: 50, priceHistory: [] })).toMatchObject({
      current: 50,
      change: 0,
      isLowest: false,
      points: 1,
    });
  });

  it('sem preço não há tendência', () => {
    expect(priceTrend({ estimatedPrice: null })).toBeNull();
  });
});

it('sortWishes põe prioridade alta primeiro mantendo a ordem dentro da mesma prioridade', () => {
  const items = [
    { id: 'a', priority: 'low' as const },
    { id: 'b', priority: 'high' as const },
    { id: 'c' },
    { id: 'd', priority: 'high' as const },
  ];
  expect(sortWishes(items).map((i) => i.id)).toEqual(['b', 'd', 'c', 'a']);
});

it('checkedAgo descreve a última leitura', () => {
  const now = new Date('2026-10-31T12:00:00Z');
  expect(checkedAgo('2026-10-31T11:30:00Z', now)).toBe('agora há pouco');
  expect(checkedAgo('2026-10-31T09:00:00Z', now)).toBe('há 3 h');
  expect(checkedAgo('2026-10-30T09:00:00Z', now)).toBe('há 1 dia');
});
