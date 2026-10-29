'use client';

import { useMemo, useState } from 'react';

import { ImportActionBar } from '@/components/ImportActionBar';
import { BRL, CATEGORIES, PAYMENT_METHOD_LABEL } from '@/lib/finance';
import { findDuplicateEntries } from '@/lib/import/dedupe';
import { useFinanceStore } from '@/lib/store';
import type { StatementEntry, StatementPreview, TransactionDraft } from '@/types/finance';

const FORMAT_LABEL: Record<StatementPreview['format'], string> = {
  ofx: 'OFX',
  csv: 'CSV',
  pdf: 'PDF (lido por IA)',
};

type Row = StatementEntry & { selected: boolean };

const ACCOUNT_TARGET = 'account';

const flip = (e: StatementEntry): StatementEntry => ({
  ...e,
  type: e.type === 'income' ? 'expense' : 'income',
});

export function StatementImportReview({
  preview,
  onCancel,
  onDone,
}: {
  preview: StatementPreview;
  onCancel: () => void;
  onDone: (message: string) => void;
}) {
  const creditCards = useFinanceStore((s) => s.creditCards);
  const importTransactions = useFinanceStore((s) => s.importTransactions);
  // Foto das transações na abertura: depois de importar, as linhas novas não viram "duplicadas" de si mesmas.
  const [existing] = useState(() => useFinanceStore.getState().transactions);

  // Conta corrente ou um cartão: no cartão, tudo entra como crédito na fatura dele.
  const [target, setTarget] = useState<string>(ACCOUNT_TARGET);
  // Fatura de cartão em CSV costuma vir com compras positivas; inverter corrige o sinal de tudo.
  const [inverted, setInverted] = useState(false);

  const duplicates = useMemo(
    () => findDuplicateEntries(inverted ? preview.entries.map(flip) : preview.entries, existing),
    [preview.entries, existing, inverted],
  );

  const [rows, setRows] = useState<Row[]>(() => {
    const initialDuplicates = findDuplicateEntries(preview.entries, existing);
    return preview.entries.map((e, i) => ({ ...e, selected: !initialDuplicates.has(i) }));
  });

  const view = rows.map((row, i) => ({
    ...(inverted ? flip(row) : row),
    selected: row.selected,
    duplicate: duplicates.has(i),
  }));
  const selected = view.filter((r) => r.selected);
  const income = selected.filter((r) => r.type === 'income').reduce((s, r) => s + r.amount, 0);
  const expense = selected.filter((r) => r.type === 'expense').reduce((s, r) => s + r.amount, 0);
  const card = creditCards.find((c) => c.id === target);

  function patchRow(index: number, patch: Partial<Row>) {
    setRows((prev) => prev.map((r, i) => (i === index ? { ...r, ...patch } : r)));
  }

  function handleImport() {
    const drafts: TransactionDraft[] = selected.map((r) => ({
      description: r.description.trim(),
      amount: r.amount,
      type: r.type,
      category: r.category,
      paymentMethod: card ? 'credit_card' : r.paymentMethod,
      creditCardId: card?.id ?? null,
      date: r.date,
      isFixed: false,
      isPaid: !card, // compra no cartão fica em aberto até a fatura ser paga
    }));
    importTransactions(drafts);
    onDone(`${drafts.length} lançamento(s) importado(s).`);
  }

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold">Revisar extrato</h2>
        <span className="badge badge-ghost">{FORMAT_LABEL[preview.format]}</span>
      </div>

      {preview.warnings.map((w) => (
        <div key={w} role="alert" className="alert alert-warning text-sm">
          <span>{w}</span>
        </div>
      ))}
      {duplicates.size > 0 && (
        <div role="status" className="alert alert-info text-sm">
          <span>
            {duplicates.size} lançamento(s) já existem no app (mesma data, valor e descrição) e
            foram desmarcados.
          </span>
        </div>
      )}

      <div className="card bg-base-200">
        <div className="card-body gap-3 p-4">
          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium">Esses lançamentos são de</span>
            <select
              className="select select-bordered w-full"
              value={target}
              onChange={(e) => setTarget(e.target.value)}
            >
              <option value={ACCOUNT_TARGET}>Conta bancária</option>
              {creditCards.map((c) => (
                <option key={c.id} value={c.id}>
                  Cartão {c.name}
                </option>
              ))}
            </select>
          </label>
          <label className="flex min-h-11 cursor-pointer items-center justify-between gap-3">
            <span className="text-sm">
              Inverter entradas e saídas
              <span className="text-base-content/60 block text-xs">
                Use se as compras aparecerem como entrada.
              </span>
            </span>
            <input
              type="checkbox"
              className="toggle"
              checked={inverted}
              onChange={(e) => setInverted(e.target.checked)}
            />
          </label>
          <div className="flex gap-2">
            <button
              type="button"
              className="btn btn-sm btn-outline flex-1"
              onClick={() => setRows((prev) => prev.map((r) => ({ ...r, selected: true })))}
            >
              Marcar todos
            </button>
            <button
              type="button"
              className="btn btn-sm btn-outline flex-1"
              onClick={() => setRows((prev) => prev.map((r) => ({ ...r, selected: false })))}
            >
              Desmarcar todos
            </button>
          </div>
        </div>
      </div>

      {view.length === 0 ? (
        <p className="text-base-content/60 py-8 text-center text-sm">
          Nenhum lançamento encontrado no arquivo.
        </p>
      ) : (
        <ul className="grid gap-2 md:grid-cols-2">
          {view.map((r, i) => (
            <li
              key={i}
              className={`card bg-base-200 border-2 ${
                r.selected ? 'border-primary/40' : 'border-transparent opacity-60'
              }`}
            >
              <div className="card-body gap-2 p-3">
                <div className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    className="checkbox checkbox-primary mt-1"
                    aria-label={`Importar ${r.description}`}
                    checked={r.selected}
                    onChange={(e) => patchRow(i, { selected: e.target.checked })}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="text-base-content/60 text-xs">
                        {formatDate(r.date)} ·{' '}
                        {card ? PAYMENT_METHOD_LABEL.credit_card : PAYMENT_METHOD_LABEL[r.paymentMethod]}
                      </span>
                      <span
                        className={`shrink-0 font-semibold ${
                          r.type === 'income' ? 'text-success' : 'text-error'
                        }`}
                      >
                        {r.type === 'income' ? '+ ' : '− '}
                        {BRL.format(r.amount)}
                      </span>
                    </div>
                    {r.duplicate && (
                      <span className="badge badge-info badge-sm mt-1">já está no app</span>
                    )}
                  </div>
                </div>
                <input
                  className="input input-bordered w-full"
                  aria-label="Descrição"
                  value={r.description}
                  maxLength={200}
                  onChange={(e) => patchRow(i, { description: e.target.value })}
                />
                <select
                  className="select select-bordered w-full"
                  aria-label="Categoria"
                  value={r.category}
                  onChange={(e) => patchRow(i, { category: e.target.value })}
                >
                  {CATEGORIES.map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
              </div>
            </li>
          ))}
        </ul>
      )}

      <ImportActionBar
        summary={
          <>
            {selected.length} de {rows.length} ·{' '}
            <span className="text-success">{BRL.format(income)}</span> ·{' '}
            <span className="text-error">{BRL.format(expense)}</span>
          </>
        }
        confirmLabel={`Importar ${selected.length}`}
        confirmDisabled={selected.length === 0 || selected.some((r) => !r.description.trim())}
        onCancel={onCancel}
        onConfirm={handleImport}
      />
    </section>
  );
}

function formatDate(iso: string): string {
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}
