'use client';

import { useMemo, useState } from 'react';

import { importLocalData } from '@/app/actions/finance';
import { useFinanceStore } from '@/lib/store';
import { useMounted } from '@/lib/useMounted';
import type { FinanceSnapshot } from '@/types/finance';

// Chave usada pelo zustand/persist antes da migração para o Postgres.
const LEGACY_KEY = 'finance-manager-ai:v1';
const BACKUP_KEY = 'finance-manager-ai:v1:backup';

type LegacyData = Omit<FinanceSnapshot, 'settings'> & { total: number };

function readLegacyData(): LegacyData | null {
  try {
    const raw = localStorage.getItem(LEGACY_KEY);
    if (!raw) return null;
    const state = (JSON.parse(raw) as { state?: Partial<FinanceSnapshot> }).state ?? {};
    const data: Omit<FinanceSnapshot, 'settings'> = {
      transactions: state.transactions ?? [],
      creditCards: state.creditCards ?? [],
      savingsGoals: state.savingsGoals ?? [],
      shoppingItems: state.shoppingItems ?? [],
      creditCardInvoices: [], // faturas, contas, dívidas e categorias não existiam na época do localStorage
      bankAccounts: [],
      debts: [],
      categories: [],
    };
    const total =
      data.transactions.length +
      data.creditCards.length +
      data.savingsGoals.length +
      data.shoppingItems.length;
    return total > 0 ? { ...data, total } : null;
  } catch {
    return null;
  }
}

/** Move o JSON antigo para uma chave de backup: o banner some, mas os dados não se perdem. */
function archiveLegacyData() {
  try {
    const raw = localStorage.getItem(LEGACY_KEY);
    if (raw) localStorage.setItem(BACKUP_KEY, raw);
    localStorage.removeItem(LEGACY_KEY);
  } catch {
    // localStorage indisponível: nada a arquivar.
  }
}

export function LocalDataImport() {
  const hydrate = useFinanceStore((s) => s.hydrate);
  const hydrated = useFinanceStore((s) => s.hydrated);
  const mounted = useMounted();
  const stored = useMemo(() => (mounted ? readLegacyData() : null), [mounted]);
  // undefined = ainda vale o que está no localStorage; null = importado ou ignorado.
  const [handled, setLegacy] = useState<null | undefined>(undefined);
  const legacy = handled === null ? null : stored;
  const [status, setStatus] = useState<'idle' | 'importing' | 'error'>('idle');

  if (!hydrated || !legacy) return null;

  async function handleImport() {
    if (!legacy) return;
    setStatus('importing');
    try {
      const { total: _, ...data } = legacy;
      const result = await importLocalData(useFinanceStore.getState().sessionUserId, data);
      // Outra conta entrou neste navegador enquanto a tela estava aberta: recarrega sem importar.
      if ('sessionChanged' in result) return window.location.reload();
      hydrate(result);
      archiveLegacyData();
      setLegacy(null);
      setStatus('idle');
    } catch (err) {
      console.error('[import] failed', err);
      setStatus('error');
    }
  }

  function handleDiscard() {
    if (!confirm('Ignorar os dados salvos neste navegador? Eles ficam guardados como backup local.')) {
      return;
    }
    archiveLegacyData();
    setLegacy(null);
  }

  return (
    <div role="status" className="alert alert-info mb-4 flex flex-wrap">
      <div className="flex-1">
        <p className="font-semibold">Dados antigos encontrados neste navegador</p>
        <p className="text-sm">
          {legacy.transactions.length} transações, {legacy.creditCards.length} cartões,{' '}
          {legacy.savingsGoals.length} caixinhas e {legacy.shoppingItems.length} itens de lista.
          Importe para o servidor para acessá-los de qualquer dispositivo.
        </p>
        {status === 'error' && (
          <p className="text-error mt-1 text-sm">A importação falhou. Tente novamente.</p>
        )}
      </div>
      <div className="flex gap-2">
        <button type="button" className="btn btn-sm btn-ghost" onClick={handleDiscard}>
          Ignorar
        </button>
        <button
          type="button"
          className="btn btn-sm btn-primary"
          onClick={handleImport}
          disabled={status === 'importing'}
        >
          {status === 'importing' && <span className="loading loading-spinner loading-xs" />}
          Importar
        </button>
      </div>
    </div>
  );
}
