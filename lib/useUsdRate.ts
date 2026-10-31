'use client';

import { useEffect, useState } from 'react';

export type UsdRate = {
  date: string; // DD/MM/AAAA, como vem do SGS
  rate: number; // R$ por US$ 1 (PTAX venda)
};

let cached: Promise<UsdRate | null> | null = null;

/** Cotação do dólar (PTAX) do Banco Central, buscada uma vez por carregamento do app. null = indisponível. */
export function useUsdRate(): UsdRate | null {
  const [usd, setUsd] = useState<UsdRate | null>(null);
  useEffect(() => {
    cached ??= fetch('/api/dolar')
      .then((r) => r.json() as Promise<{ ok: boolean; data?: UsdRate }>)
      .then((p) => (p.ok && p.data ? p.data : null))
      .catch(() => null);
    let alive = true;
    cached.then((value) => alive && setUsd(value));
    return () => {
      alive = false;
    };
  }, []);
  return usd;
}
