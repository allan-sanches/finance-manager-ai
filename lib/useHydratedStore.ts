'use client';

import { useFinanceStore } from '@/lib/store';
import { useMounted } from '@/lib/useMounted';

/**
 * Garante que componentes só leem do localStorage após hidratação no client,
 * evitando hydration mismatch quando o Next renderiza estado vazio no servidor.
 */
export function useHydrated(): boolean {
  const hydrated = useFinanceStore((s) => s.hydrated);
  return useMounted() && hydrated;
}
