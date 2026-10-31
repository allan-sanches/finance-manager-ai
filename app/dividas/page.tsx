'use client';

import { Eye, EyeOff, Pencil, Plus, StickyNote } from 'lucide-react';
import Link from 'next/link';
import { useMemo, useState } from 'react';

import { DebtFormDialog } from '@/components/DebtFormDialog';
import { DebtStatusesDialog } from '@/components/DebtStatusesDialog';
import { EmptyState, PageHeader, SectionTitle } from '@/components/ui';
import {
  BRL,
  DEBT_SOURCE_LABEL,
  debtStatusOption,
  debtsOnDashboard,
  summarizeDebts,
} from '@/lib/finance';
import { useFinanceStore } from '@/lib/store';
import { TONE_CLASS } from '@/lib/tones';
import { useHydrated } from '@/lib/useHydratedStore';
import type { Debt, DebtStatus } from '@/types/finance';

type Filter = 'all' | DebtStatus;

export default function DividasPage() {
  const hydrated = useHydrated();
  const debts = useFinanceStore((s) => s.debts);
  const settings = useFinanceStore((s) => s.settings);
  const updateSettings = useFinanceStore((s) => s.updateSettings);

  const [filter, setFilter] = useState<Filter>('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Debt | undefined>(undefined);
  const [statusesOpen, setStatusesOpen] = useState(false);
  const statuses = settings.debtStatuses;

  const visible = useMemo(
    () =>
      (filter === 'all' ? debts : debts.filter((d) => d.status === filter))
        .slice()
        .sort((a, b) => b.currentAmount + b.overdueAmount - (a.currentAmount + a.overdueAmount)),
    [debts, filter],
  );
  const onDashboard = summarizeDebts(debtsOnDashboard(debts, settings));
  const outside = summarizeDebts(
    debts.filter((d) => !settings.dashboardDebtStatuses.includes(d.status)),
  );
  const countBy = (s: DebtStatus) => debts.filter((d) => d.status === s).length;

  function toggleDashboard(status: DebtStatus) {
    const current = settings.dashboardDebtStatuses;
    updateSettings({
      dashboardDebtStatuses: current.includes(status)
        ? current.filter((s) => s !== status)
        : [...current, status],
    });
  }

  function open(debt?: Debt) {
    setEditing(debt);
    setDialogOpen(true);
  }

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-4">
      <PageHeader
        title="Dívidas"
        subtitle="Controle a situação de cada dívida e o que aparece no dashboard."
        action={
          <button type="button" className="btn btn-primary" onClick={() => open()}>
            <Plus className="h-5 w-5" aria-hidden /> Nova dívida
          </button>
        }
      />

      <section className="grid grid-cols-2 gap-3">
        <div className="tile flex flex-col gap-1 bg-red-500 p-4 text-white">
          <span className="eyebrow">No dashboard</span>
          <span className="metric text-2xl">{hydrated ? BRL.format(onDashboard.total) : '—'}</span>
          <span className="text-xs font-semibold opacity-90">
            {hydrated ? `${BRL.format(onDashboard.overdue)} vencida` : ''}
          </span>
        </div>
        <div className="tile flex flex-col gap-1 bg-slate-200 p-4 text-neutral-900">
          <span className="eyebrow">Fora do dashboard</span>
          <span className="metric text-2xl">{hydrated ? BRL.format(outside.total) : '—'}</span>
          <span className="text-xs font-semibold opacity-80">abandonadas, quitadas…</span>
        </div>
      </section>

      <section className="panel p-4">
        <div className="flex items-start justify-between gap-2">
          <SectionTitle>Aparecem no dashboard</SectionTitle>
          <button type="button" className="btn btn-ghost btn-sm min-h-11" onClick={() => setStatusesOpen(true)}>
            <Pencil className="h-4 w-4" aria-hidden /> Editar situações
          </button>
        </div>
        <div className="flex flex-wrap gap-2">
          {statuses.map(({ id: s, label }) => {
            const on = settings.dashboardDebtStatuses.includes(s);
            return (
              <button
                key={s}
                type="button"
                aria-pressed={on}
                className={`btn btn-sm gap-1.5 rounded-full ${on ? 'btn-neutral' : 'btn-ghost bg-base-200 opacity-70'}`}
                onClick={() => toggleDashboard(s)}
              >
                {on ? (
                  <Eye className="h-4 w-4" aria-hidden />
                ) : (
                  <EyeOff className="h-4 w-4" aria-hidden />
                )}
                {label}
              </button>
            );
          })}
        </div>
        <p className="text-base-content/60 mt-2 text-xs">
          Toque para mostrar ou esconder. Os totais e o card de dívidas do Início só somam as
          situações marcadas.
        </p>
      </section>

      <div
        role="tablist"
        className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 md:mx-0 md:px-0"
      >
        {(['all', ...statuses.map((s) => s.id)] as Filter[]).map((f) => (
          <button
            key={f}
            role="tab"
            type="button"
            aria-selected={filter === f}
            className={`btn btn-sm shrink-0 rounded-full ${filter === f ? 'btn-neutral' : 'btn-ghost bg-base-100'}`}
            onClick={() => setFilter(f)}
          >
            {f === 'all' ? `Todas (${debts.length})` : `${debtStatusOption(settings, f).label} (${countBy(f)})`}
          </button>
        ))}
      </div>

      {!hydrated ? (
        <p className="text-base-content/60 py-10 text-center text-sm">Carregando…</p>
      ) : visible.length === 0 ? (
        <EmptyState
          emoji="🧾"
          title={debts.length === 0 ? 'Nenhuma dívida ainda' : 'Nada nessa situação'}
        >
          {debts.length === 0 ? (
            <>
              Cadastre à mão ou importe o Registrato/Serasa em{' '}
              <Link href="/importar" className="link link-primary">
                Importar
              </Link>
              .
            </>
          ) : null}
        </EmptyState>
      ) : (
        <ul className="panel divide-base-content/5 divide-y overflow-hidden">
          {visible.map((d) => (
            <li key={d.id}>
              <button
                type="button"
                className="hover:bg-base-200 flex w-full items-start gap-3 p-4 text-left"
                onClick={() => open(d)}
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{d.creditor}</p>
                  <p className="text-base-content/70 line-clamp-2 text-sm">{d.description}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    <span
                      className={`badge badge-sm border-0 font-bold ${TONE_CLASS[debtStatusOption(settings, d.status).tone]}`}
                    >
                      {debtStatusOption(settings, d.status).label}
                    </span>
                    <span className="badge badge-sm badge-ghost">
                      {DEBT_SOURCE_LABEL[d.source]}
                    </span>
                    {!settings.dashboardDebtStatuses.includes(d.status) && (
                      <span className="text-base-content/50 flex items-center gap-1 text-xs">
                        <EyeOff className="h-3 w-3" aria-hidden /> fora do dashboard
                      </span>
                    )}
                  </div>
                  {d.notes && (
                    <p className="text-base-content/70 mt-2 flex gap-1.5 text-sm">
                      <StickyNote className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                      <span className="line-clamp-2">{d.notes}</span>
                    </p>
                  )}
                </div>
                <div className="shrink-0 text-right">
                  <p className="font-bold tabular-nums">
                    {BRL.format(d.currentAmount + d.overdueAmount)}
                  </p>
                  {d.overdueAmount > 0 && (
                    <p className="text-error text-xs font-semibold">
                      {BRL.format(d.overdueAmount)} vencida
                    </p>
                  )}
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}

      <DebtFormDialog open={dialogOpen} onClose={() => setDialogOpen(false)} initial={editing} />
      <DebtStatusesDialog open={statusesOpen} onClose={() => setStatusesOpen(false)} />
    </div>
  );
}
