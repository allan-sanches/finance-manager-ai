'use client';

import Link from 'next/link';

import { BRL, DEBT_SOURCE_LABEL, debtsOnDashboard, summarizeDebts } from '@/lib/finance';
import { useFinanceStore } from '@/lib/store';
import type { Debt } from '@/types/finance';

/** Card de dívidas do dashboard: só as situações marcadas em Dívidas → "Aparecem no dashboard". */
export function DebtsOverview() {
  const allDebts = useFinanceStore((s) => s.debts);
  const settings = useFinanceStore((s) => s.settings);
  const debts = debtsOnDashboard(allDebts, settings);
  const hidden = allDebts.length - debts.length;
  const summary = summarizeDebts(debts);

  if (debts.length === 0) {
    return (
      <div className="panel">
        <div className="card-body">
          <h2 className="eyebrow">Dívidas e empréstimos</h2>
          <p className="text-base-content/60 text-sm">
            {hidden > 0 ? (
              <>
                {hidden} dívida(s) escondida(s) pela situação. Veja em{' '}
                <Link href="/dividas" className="link link-primary">
                  Dívidas
                </Link>
                .
              </>
            ) : (
              <>
                Nenhuma dívida. Importe o Registrato ou o Serasa em{' '}
                <Link href="/importar" className="link link-primary">
                  Importar
                </Link>
                .
              </>
            )}
          </p>
        </div>
      </div>
    );
  }

  const byCreditor = groupByCreditor(debts);
  const sources = [...new Set(debts.map((d) => d.source))];

  return (
    <div className="panel">
      <div className="card-body gap-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="eyebrow">Dívidas e empréstimos</h2>
          <span className="text-base-content/60 text-xs">
            {sources
              .map((s) => `${DEBT_SOURCE_LABEL[s]} ${formatMonth(latestDate(debts, s))}`.trim())
              .join(' · ')}
          </span>
        </div>

        <div className="grid grid-cols-3 gap-2 text-center">
          <Metric label="Total" value={BRL.format(summary.total)} tone="bg-amber-300 text-neutral-900" />
          <Metric label="Em dia" value={BRL.format(summary.current)} tone="bg-cyan-300 text-neutral-900" />
          <Metric
            label="Vencida"
            value={BRL.format(summary.overdue)}
            tone={summary.overdue > 0 ? 'bg-red-500 text-white' : 'bg-emerald-200 text-neutral-900'}
          />
        </div>

        <ul className="space-y-2 text-sm">
          {byCreditor.slice(0, 5).map((g) => (
            <li key={g.creditor} className="space-y-1">
              <div className="flex justify-between gap-2">
                <span className="truncate font-medium">{g.creditor}</span>
                <span className="shrink-0">{BRL.format(g.total)}</span>
              </div>
              <progress
                className={`progress h-2.5 w-full ${g.overdue > 0 ? 'progress-error' : 'progress-primary'}`}
                value={Math.round((g.total / Math.max(1, summary.total)) * 100)}
                max={100}
              />
            </li>
          ))}
        </ul>

        <div className="card-actions justify-end">
          <Link href="/dividas" className="btn btn-sm btn-ghost">
            {hidden > 0 ? `Ver todas (+${hidden} escondidas)` : 'Ver dívidas'}
          </Link>
        </div>
      </div>
    </div>
  );
}

function Metric({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <div className={`rounded-field px-2 py-2.5 ${tone}`}>
      <p className="eyebrow !text-[10px]">{label}</p>
      <p className="metric mt-1 text-sm sm:text-lg">{value}</p>
    </div>
  );
}

type CreditorGroup = { creditor: string; total: number; overdue: number };

function groupByCreditor(debts: ReadonlyArray<Debt>): CreditorGroup[] {
  const groups = new Map<string, CreditorGroup>();
  for (const d of debts) {
    const g = groups.get(d.creditor) ?? { creditor: d.creditor, total: 0, overdue: 0 };
    g.total += d.currentAmount + d.overdueAmount;
    g.overdue += d.overdueAmount;
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
