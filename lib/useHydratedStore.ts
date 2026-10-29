'use client';

import { useEffect, useState } from 'react';

import { useFinanceStore } from '@/lib/store';

/**
 * Garante que componentes só leem do localStorage após hidratação no client,
 * evitando hydration mismatch quando o Next renderiza estado vazio no servidor.
 */
export function useHydrated(): boolean {
  const hydrated = useFinanceStore((s) => s.hydrated);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return mounted && hydrated;
}
