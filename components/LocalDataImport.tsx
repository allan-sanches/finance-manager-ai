'use client';

import { useEffect, useState } from 'react';

import { importLocalData } from '@/app/actions/finance';
import { useFinanceStore } from '@/lib/store';
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
      debts: [], // dívidas e categorias não existiam na época do localStorage
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
  const [legacy, setLegacy] = useState<LegacyData | null>(null);
  const [status, setStatus] = useState<'idle' | 'importing' | 'error'>('idle');

  useEffect(() => {
    setLegacy(readLegacyData());
  }, []);

  if (!hydrated || !legacy) return null;

  async function handleImport() {
    if (!legacy) return;
    setStatus('importing');
    try {
      const { total: _, ...data } = legacy;
      hydrate(await importLocalData(data));
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
