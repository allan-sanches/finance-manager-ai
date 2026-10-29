'use client';

import Link from 'next/link';

import { BRL, DEBT_SOURCE_LABEL, summarizeDebts } from '@/lib/finance';
import { useFinanceStore } from '@/lib/store';
import type { Debt } from '@/types/finance';

/** compact: card do dashboard (total por credor). Completo: aba Dívidas, com cada modalidade. */
export function DebtsOverview({ compact = false }: { compact?: boolean }) {
  const debts = useFinanceStore((s) => s.debts);
  const removeDebt = useFinanceStore((s) => s.removeDebt);
  const summary = summarizeDebts(debts);

  if (debts.length === 0) {
    return (
      <div className="card bg-base-200 shadow">
        <div className="card-body">
          <h2 className="card-title">Dívidas e empréstimos</h2>
          <p className="text-base-content/60 text-sm">
            Nenhuma dívida importada. Envie o relatório do Registrato ou do Serasa em{' '}
            <Link href="/importar" className="link link-primary">
              Importar
            </Link>
            .
          </p>
        </div>
      </div>
    );
  }

  const byCreditor = groupByCreditor(debts);
  const sources = [...new Set(debts.map((d) => d.source))];

  return (
    <div className="card bg-base-200 shadow">
      <div className="card-body gap-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="card-title">Dívidas e empréstimos</h2>
          <span className="text-base-content/60 text-xs">
            {sources
              .map((s) => `${DEBT_SOURCE_LABEL[s]} ${formatMonth(latestDate(debts, s))}`)
              .join(' · ')}
          </span>
        </div>

        <div className="grid grid-cols-3 gap-2 text-center">
          <Metric label="Total" value={BRL.format(summary.total)} />
          <Metric label="Em dia" value={BRL.format(summary.current)} />
          <Metric
            label="Vencida"
            value={BRL.format(summary.overdue)}
            className={summary.overdue > 0 ? 'text-error' : ''}
          />
        </div>

        {compact ? (
          <ul className="space-y-2 text-sm">
            {byCreditor.slice(0, 5).map((g) => (
              <li key={g.creditor} className="space-y-1">
                <div className="flex justify-between gap-2">
                  <span className="truncate font-medium">{g.creditor}</span>
                  <span className="shrink-0">{BRL.format(g.total)}</span>
                </div>
                <progress
                  className={`progress w-full ${g.overdue > 0 ? 'progress-error' : 'progress-primary'}`}
                  value={Math.round((g.total / summary.total) * 100)}
                  max={100}
                />
              </li>
            ))}
          </ul>
        ) : (
          <ul className="divide-base-300 divide-y">
            {byCreditor.map((g) => (
              <li key={g.creditor} className="py-3">
                <p className="font-semibold">{g.creditor}</p>
                <ul className="mt-1 space-y-2">
                  {g.items.map((d) => (
                    <li key={d.id} className="flex items-start justify-between gap-3 text-sm">
                      <div className="min-w-0">
                        <p className="text-base-content/80">{d.description}</p>
                        <p className="space-x-3">
                          {d.currentAmount > 0 && <span>Em dia {BRL.format(d.currentAmount)}</span>}
                          {d.overdueAmount > 0 && (
                            <span className="text-error font-medium">
                              Vencida {BRL.format(d.overdueAmount)}
                            </span>
                          )}
                        </p>
                      </div>
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm text-error shrink-0"
                        onClick={() => {
                          if (confirm(`Remover "${d.description}" de ${d.creditor}?`)) removeDebt(d.id);
                        }}
                      >
                        Remover
                      </button>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        )}

        <div className="card-actions justify-end">
          <Link href="/importar" className="btn btn-sm btn-ghost">
            Atualizar relatórios
          </Link>
        </div>
      </div>
    </div>
  );
}

function Metric({ label, value, className }: { label: string; value: string; className?: string }) {
  return (
    <div className="bg-base-100 rounded-box px-2 py-2">
      <p className="text-base-content/60 text-xs">{label}</p>
      <p className={`text-sm font-semibold sm:text-base ${className ?? ''}`}>{value}</p>
    </div>
  );
}

type CreditorGroup = { creditor: string; total: number; overdue: number; items: Debt[] };

function groupByCreditor(debts: ReadonlyArray<Debt>): CreditorGroup[] {
  const groups = new Map<string, CreditorGroup>();
  for (const d of debts) {
    const g = groups.get(d.creditor) ?? { creditor: d.creditor, total: 0, overdue: 0, items: [] };
    g.total += d.currentAmount + d.overdueAmount;
    g.overdue += d.overdueAmount;
    g.items.push(d);
    groups.set(d.creditor, g);
  }
  return [...groups.values()].sort((a, b) => b.total - a.total);
}

function latestDate(debts: ReadonlyArray<Debt>, source: Debt['source']): string {
  return debts
    .filter((d) => d.source === source)
    .reduce((max, d) => (d.referenceDate > max ? d.referenceDate : max), '');
}

function formatMonth(iso: string): string {
  const [y, m] = iso.split('-');
  return y && m ? `${m}/${y}` : '';
}
