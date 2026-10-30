'use client';

import { useEffect, useState } from 'react';

import type { SelicOutlook } from '@/lib/savings';

export type Cdi = {
  date: string; // DD/MM/AAAA, como vem do SGS
  annualRate: number;
  selicOutlook: SelicOutlook; // vazio se o Focus não respondeu
  outlookDate: string | null; // AAAA-MM-DD do boletim Focus
};

let cached: Promise<Cdi | null> | null = null;

/** CDI anual (% a.a.) e Selic esperada (Focus) do Banco Central, buscados uma vez por carregamento do app. null = indisponível. */
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
