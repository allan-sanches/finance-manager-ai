'use client';

import { usePathname } from 'next/navigation';
import { useEffect } from 'react';

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
    <div className="app-shell">
      <Sidebar />
      <div className="flex min-h-dvh flex-col">
        <MobileNavbar />
        <main className="flex-1 px-4 py-6 md:px-8 md:py-8">
          <SyncErrorAlert />
          <LocalDataImport />
          {children}
        </main>
      </div>
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
