'use client';

import { useEffect, useState } from 'react';

export type Cdi = { date: string; annualRate: number };

let cached: Promise<Cdi | null> | null = null;

/** CDI anual (% a.a.) do Banco Central, buscado uma vez por carregamento do app. null = indisponível. */
export function useCdi(): Cdi | null {
  const [cdi, setCdi] = useState<Cdi | null>(null);
  useEffect(() => {
    cached ??= fetch('/api/cdi')
      .then((r) => r.json() as Promise<{ ok: boolean; data?: Cdi }>)
      .then((p) => (p.ok && p.data ? p.data : null))
      .catch(() => null);
    let alive = true;
    cached.then((value) => alive && setCdi(value));
    return () => {
      alive = false;
    };
  }, []);
  return cdi;
}
