'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useLayoutEffect, useRef } from 'react';

import { BottomTabBar } from '@/components/BottomTabBar';
import { LocalDataImport } from '@/components/LocalDataImport';
import { MarxChat } from '@/components/MarxChat';
import { MobileNavbar } from '@/components/MobileNavbar';
import { usePrivacyHidden } from '@/components/PrivacyToggle';
import { Sidebar } from '@/components/Sidebar';
import { readSavedPrivacy, setPrivate } from '@/lib/privacy';
import { useFinanceStore } from '@/lib/store';
import type { FinanceSnapshot } from '@/types/finance';

export function AppShell({
  snapshot,
  userId,
  canImportLegacy,
  children,
}: {
  snapshot: FinanceSnapshot | null;
  userId: string | null;
  /** Só a conta original pode importar os dados antigos do navegador. */
  canImportLegacy: boolean;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const hydrate = useFinanceStore((s) => s.hydrate);
  const reset = useFinanceStore((s) => s.reset);
  const refresh = useFinanceStore((s) => s.refresh);

  // Olho: lido antes do primeiro paint, e antes da hidratação do store (os valores só aparecem depois dela).
  const privateMode = usePrivacyHidden();
  useLayoutEffect(() => {
    if (readSavedPrivacy()) setPrivate(true);
  }, []);

  // Sem sessão (logout), a memória da aba é apagada: os dados de uma conta não ficam para a próxima.
  // O snapshot do layout só hidrata na primeira vez (ou ao trocar de conta). Depois disso ele pode vir
  // do cache de prefetch do Next, mais velho que as alterações já feitas (ex.: caixinha apagada voltava
  // no dashboard); então só pede uma releitura ao servidor, na fila das alterações.
  const hydratedUser = useRef<string | null>(null);
  useEffect(() => {
    if (!snapshot || !userId) {
      hydratedUser.current = null;
      reset();
    } else if (hydratedUser.current !== userId) {
      hydratedUser.current = userId;
      hydrate(snapshot, userId);
    } else {
      refresh();
    }
  }, [snapshot, userId, hydrate, reset, refresh]);

  if (pathname === '/login') return <>{children}</>;

  // A key remonta a tela ao trocar o olho: os valores são formatados na renderização (BRL/USD).
  // O Marx fica fora dela para a conversa não sumir; a key dele só muda ao trocar de conta.
  return (
    <>
      <div key={privateMode ? 'privado' : 'visivel'} className="min-h-dvh md:grid md:grid-cols-[17rem_1fr]">
        <Sidebar />
        <div className="flex min-h-dvh min-w-0 flex-col">
          <MobileNavbar />
          <main className="pb-tabbar flex-1 px-4 pt-2 md:px-8 md:pt-8 md:pb-10">
            <SyncErrorAlert />
            {canImportLegacy && <LocalDataImport />}
            {children}
          </main>
        </div>
        <BottomTabBar />
      </div>
      <MarxChat key={userId ?? 'anon'} />
    </>
  );
}

function SyncErrorAlert() {
  const syncError = useFinanceStore((s) => s.syncError);
  const dismiss = useFinanceStore((s) => s.dismissSyncError);
  if (!syncError) return null;
  return (
    <div role="alert" className="alert alert-error mb-4">
      <span>{syncError}</span>
      <button type="button" className="btn btn-sm btn-ghost" onClick={dismiss}>
        Fechar
      </button>
    </div>
  );
}
