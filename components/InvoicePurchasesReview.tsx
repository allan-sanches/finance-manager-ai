'use client';

import { BRL, shortDate } from '@/lib/finance';
import { useCategories } from '@/lib/useCategories';
import type { InvoiceEntry } from '@/types/finance';

export type PurchaseRow = InvoiceEntry & { selected: boolean; duplicate: boolean };

/** Valor líquido das linhas: estorno (income) abate das compras. */
export const netOf = (rows: ReadonlyArray<PurchaseRow>) =>
  rows.reduce((sum, r) => sum + (r.type === 'income' ? -r.amount : r.amount), 0);

/**
 * Lançamentos lidos da fatura, para o usuário escolher quais viram transação no cartão.
 * As que já existem no app (mesmo valor, ±1 dia) chegam desmarcadas.
 */
export function InvoicePurchasesReview({
  rows,
  onChange,
  invoiceAmount,
}: {
  rows: PurchaseRow[];
  onChange: (rows: PurchaseRow[]) => void;
  invoiceAmount: number | null;
}) {
  const { names: categoryNames } = useCategories();
  const selected = rows.filter((r) => r.selected);
  const duplicates = rows.filter((r) => r.duplicate).length;
  const total = netOf(rows);
  const mismatch = invoiceAmount != null && Math.abs(total - invoiceAmount) >= 0.01;

  const patch = (index: number, change: Partial<PurchaseRow>) =>
    onChange(rows.map((r, i) => (i === index ? { ...r, ...change } : r)));
  const selectAll = (value: boolean) => onChange(rows.map((r) => ({ ...r, selected: value })));

  return (
    <div className="bg-base-100 rounded-box flex flex-col gap-2 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-bold">
          Compras da fatura · {selected.length} de {rows.length} marcadas
        </p>
        <div className="flex gap-1">
          <button type="button" className="btn btn-ghost btn-xs min-h-9" onClick={() => selectAll(true)}>
            Todas
          </button>
          <button type="button" className="btn btn-ghost btn-xs min-h-9" onClick={() => selectAll(false)}>
            Nenhuma
          </button>
        </div>
      </div>
      <p className="text-base-content/60 text-xs">
        As marcadas entram em Transações como compra neste cartão quando você salvar a fatura.
        {duplicates > 0 && ` ${duplicates} já existe(m) no app (mesmo valor e data) e veio(vieram) desmarcada(s).`}
      </p>

      <ul className="divide-base-content/10 max-h-80 divide-y overflow-y-auto">
        {rows.map((r, i) => (
          <li key={i} className={`flex items-start gap-3 py-2 ${r.selected ? '' : 'opacity-60'}`}>
            <input
              type="checkbox"
              className="checkbox checkbox-primary mt-1"
              aria-label={`Importar ${r.description}`}
              checked={r.selected}
              onChange={(e) => patch(i, { selected: e.target.checked })}
            />
            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-2">
                <p className="truncate text-sm font-semibold">{r.description}</p>
                <p
                  className={`shrink-0 text-sm font-bold tabular-nums ${r.type === 'income' ? 'text-success' : ''}`}
                >
                  {r.type === 'income' ? '+ ' : ''}
                  {BRL.format(r.amount)}
                </p>
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <span className="text-base-content/60 text-xs">{shortDate(r.date)}</span>
                {r.duplicate && <span className="badge badge-xs badge-info">já lançada</span>}
                {r.type === 'income' && <span className="badge badge-xs badge-success">estorno</span>}
                <select
                  className="select select-bordered select-xs ml-auto max-w-40"
                  aria-label={`Categoria de ${r.description}`}
                  value={r.category}
                  onChange={(e) => patch(i, { category: e.target.value })}
                >
                  {(categoryNames.includes(r.category) ? categoryNames : [r.category, ...categoryNames]).map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </li>
        ))}
      </ul>

      <p className={`text-xs font-semibold ${mismatch ? 'text-warning' : 'text-base-content/70'}`}>
        Soma dos lançamentos lidos: {BRL.format(total)}
        {invoiceAmount != null && ` · total da fatura: ${BRL.format(invoiceAmount)}`}
        {mismatch && ' (diferença pode ser saldo anterior, juros ou linhas que a IA não leu)'}
      </p>
    </div>
  );
}
