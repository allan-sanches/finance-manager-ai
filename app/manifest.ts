import type { MetadataRoute } from 'next';

import { ICON_BACKGROUND } from '@/lib/app-icon';

/** Torna o app instalável no celular (Android: "Instalar app"; abre sem a barra do navegador). */
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: '/',
    name: 'Capitalismo Selvagem',
    short_name: 'Capitalismo',
    description: 'Suas finanças pessoais: transações, cartões, dívidas, caixinhas e listas.',
    lang: 'pt-BR',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: ICON_BACKGROUND,
    theme_color: ICON_BACKGROUND,
    icons: [
      { src: '/icon/192', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icon/512', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icon/512', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
    shortcuts: [
      { name: 'Transações', url: '/transacoes' },
      { name: 'Entrada por IA', url: '/ia-input' },
    ],
  };
}
