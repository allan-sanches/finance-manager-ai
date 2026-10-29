import type { Metadata } from 'next';

import { AppShell } from '@/components/AppShell';
import { hasSession } from '@/lib/auth';
import { getDb } from '@/lib/db';
import { getSnapshot } from '@/lib/db/repository';

import './globals.css';

export const metadata: Metadata = {
  title: 'finance-manager-ai',
  description:
    'Gerencie suas finanças pessoais com IA: lance transações por linguagem natural, acompanhe metas e dashboards.',
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // O proxy já barra quem não tem sessão; aqui a checagem só evita consultar o banco na tela de login.
  const snapshot = (await hasSession()) ? await getSnapshot(getDb()) : null;

  return (
    <html lang="pt-BR" data-theme="light">
      <body className="bg-base-100 text-base-content">
        <AppShell snapshot={snapshot}>{children}</AppShell>
      </body>
    </html>
  );
}
