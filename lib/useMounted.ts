'use client';

import { useState, useSyncExternalStore } from 'react';

const noopSubscribe = () => () => {};

/** false no servidor e na hidratação, true depois: liberado para ler localStorage sem mismatch. */
export function useMounted(): boolean {
  return useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  );
}

/**
 * true no render em que o diálogo abre (ou troca o item editado). O formulário reseta os campos
 * nesse mesmo render, em vez de um useEffect que renderizaria duas vezes.
 */
export function useOpenedWith(open: boolean, ...sources: unknown[]): boolean {
  const [prev, setPrev] = useState<{ open: boolean; sources: unknown[] }>({ open: false, sources });
  const changed = prev.open !== open || prev.sources.some((s, i) => s !== sources[i]);
  if (!changed) return false;
  setPrev({ open, sources });
  return open;
}
