'use client';

import { useState } from 'react';

import { ImportActionBar } from '@/components/ImportActionBar';
import { BRL, DEBT_SOURCE_LABEL } from '@/lib/finance';
import { useFinanceStore } from '@/lib/store';
import type { DebtEntry, DebtReportPreview } from '@/types/finance';

type Row = DebtEntry & { selected: boolean };

export function DebtImportReview({
  preview,
  onCancel,
  onDone,
}: {
  preview: DebtReportPreview;
  onCancel: () => void;
  onDone: (message: string) => void;
}) {
  const replaceDebts = useFinanceStore((s) => s.replaceDebts);
  const existingCount = useFinanceStore(
    (s) => s.debts.filter((d) => d.source === preview.source).length,
  );
  const [rows, setRows] = useState<Row[]>(() =>
    preview.entries.map((e) => ({ ...e, selected: true })),
  );

  const selected = rows.filter((r) => r.selected);
  const current = selected.reduce((s, r) => s + r.currentAmount, 0);
  const overdue = selected.reduce((s, r) => s + r.overdueAmount, 0);
  const sourceLabel = DEBT_SOURCE_LABEL[preview.source];

  function handleSave() {
    if (
      existingCount > 0 &&
      !confirm(
        `Isso substitui as ${existingCount} dívida(s) importadas antes do ${sourceLabel}. Continuar?`,
      )
    ) {
      return;
    }
    replaceDebts(
      preview.source,
      selected.map(({ selected: _, ...entry }) => entry),
    );
    onDone(`${selected.length} dívida(s) do ${sourceLabel} salvas.`);
  }

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold">Revisar dívidas · {sourceLabel}</h2>
        {rows[0] && (
          <span className="badge badge-ghost">referência {formatMonth(rows[0].referenceDate)}</span>
        )}
      </div>

      {preview.warnings.length === 0 && preview.source === 'scr' ? (
        <div role="status" className="alert alert-success text-sm">
          <span>A soma das linhas bate com o total do relatório.</span>
        </div>
      ) : (
        preview.warnings.map((w) => (
          <div key={w} role="alert" className="alert alert-warning text-sm">
            <span>{w}</span>
          </div>
        ))
      )}

      <div className="stats stats-horizontal bg-base-200 w-full">
        <div className="stat px-4 py-3">
          <div className="stat-title text-xs">Em dia</div>
          <div className="stat-value text-lg">{BRL.format(current)}</div>
        </div>
        <div className="stat px-4 py-3">
          <div className="stat-title text-xs">Vencida</div>
          <div className={`stat-value text-lg ${overdue > 0 ? 'text-error' : ''}`}>
            {BRL.format(overdue)}
          </div>
        </div>
      </div>

      <ul className="grid gap-2 md:grid-cols-2">
        {rows.map((r, i) => (
          <li
            key={i}
            className={`card bg-base-200 border-2 ${
              r.selected ? 'border-primary/40' : 'border-transparent opacity-60'
            }`}
          >
            <label className="card-body cursor-pointer flex-row items-start gap-3 p-3">
              <input
                type="checkbox"
                className="checkbox checkbox-primary mt-1"
                checked={r.selected}
                onChange={(e) =>
                  setRows((prev) =>
                    prev.map((row, j) => (j === i ? { ...row, selected: e.target.checked } : row)),
                  )
                }
              />
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{r.creditor}</p>
                <p className="text-base-content/70 text-sm">{r.description}</p>
                <div className="mt-1 flex flex-wrap gap-x-4 text-sm">
                  {r.currentAmount > 0 && <span>Em dia {BRL.format(r.currentAmount)}</span>}
                  {r.overdueAmount > 0 && (
                    <span className="text-error font-medium">
                      Vencida {BRL.format(r.overdueAmount)}
                    </span>
                  )}
                </div>
              </div>
            </label>
          </li>
        ))}
      </ul>

      <ImportActionBar
        summary={
          existingCount > 0
            ? `Substitui ${existingCount} dívida(s) do ${sourceLabel} já salvas`
            : `${selected.length} de ${rows.length} selecionada(s)`
        }
        confirmLabel={`Salvar ${selected.length} dívida(s)`}
        confirmDisabled={selected.length === 0}
        onCancel={onCancel}
        onConfirm={handleSave}
      />
    </section>
  );
}

function formatMonth(iso: string): string {
  const [y, m] = iso.split('-');
  return `${m}/${y}`;
}
