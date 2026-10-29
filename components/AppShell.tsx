'use client';

import { usePathname } from 'next/navigation';
import { useEffect } from 'react';

import { BottomTabBar } from '@/components/BottomTabBar';
import { LocalDataImport } from '@/components/LocalDataImport';
import { MobileNavbar } from '@/components/MobileNavbar';
import { Sidebar } from '@/components/Sidebar';
import { useFinanceStore } from '@/lib/store';
import type { FinanceSnapshot } from '@/types/finance';

export function AppShell({
  snapshot,
  children,
}: {
  snapshot: FinanceSnapshot | null;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const hydrate = useFinanceStore((s) => s.hydrate);

  useEffect(() => {
    if (snapshot) hydrate(snapshot);
  }, [snapshot, hydrate]);

  if (pathname === '/login') return <>{children}</>;

  return (
    <div className="min-h-dvh md:grid md:grid-cols-[17rem_1fr]">
      <Sidebar />
      <div className="flex min-h-dvh min-w-0 flex-col">
        <MobileNavbar />
        <main className="pb-tabbar flex-1 px-4 pt-2 md:px-8 md:pt-8 md:pb-10">
          <SyncErrorAlert />
          <LocalDataImport />
          {children}
        </main>
      </div>
      <BottomTabBar />
    </div>
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
