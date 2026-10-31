import type { Metadata, Viewport } from 'next';
import { Space_Grotesk } from 'next/font/google';

import { AppShell } from '@/components/AppShell';
import { ServiceWorkerRegister } from '@/components/ServiceWorkerRegister';
import { themeInitScript } from '@/lib/theme';
import { getSessionUserId } from '@/lib/auth';
import { getDb } from '@/lib/db';
import { getSnapshot, OWNER_ID } from '@/lib/db/repository';

import './globals.css';

const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  variable: '--font-space-grotesk',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Capitalismo Selvagem',
  description:
    'Gerencie suas finanças pessoais com IA: lance transações por linguagem natural, acompanhe metas e dashboards.',
  appleWebApp: { capable: true, title: 'Capitalismo Selvagem', statusBarStyle: 'black-translucent' },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f3f4f7' },
    { media: '(prefers-color-scheme: dark)', color: '#2e3138' },
  ],
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // O proxy já barra quem não tem sessão; aqui a checagem só evita consultar o banco na tela de login.
  const userId = await getSessionUserId();
  const snapshot = userId ? await getSnapshot(getDb(), userId) : null;

  return (
    // data-theme é aplicado pelo script antes da hidratação (escolha salva); sem ele, segue o sistema.
    <html lang="pt-BR" className={spaceGrotesk.variable} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body>
        <AppShell snapshot={snapshot} userId={userId} canImportLegacy={userId === OWNER_ID}>
          {children}
        </AppShell>
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
