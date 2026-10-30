'use client';

import { useEffect } from 'react';

/** Registra o public/sw.js. Só em produção: em dev o cache atrapalharia o hot reload. */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production' || !('serviceWorker' in navigator)) return;
    navigator.serviceWorker.register('/sw.js', { scope: '/', updateViaCache: 'none' }).catch((err) => {
      console.error('[sw] registro falhou', err);
    });
  }, []);
  return null;
}
