'use client';

import { Plus, Trash2 } from 'lucide-react';
import { useEffect, useRef, useState, type FormEvent } from 'react';

import { DEFAULT_DEBT_STATUS } from '@/lib/finance';
import { useFinanceStore } from '@/lib/store';
import { normalizeCategoryName, TONE_CLASS, TONES, type Tone } from '@/lib/tones';
import { useOpenedWith } from '@/lib/useMounted';
import type { DebtStatusOption } from '@/types/finance';

type Props = { open: boolean; onClose: () => void };

const newStatusId = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? `custom-${crypto.randomUUID()}`
    : `custom-${Date.now().toString(36)}`;

const nextTone = (tone: Tone): Tone => TONES[(TONES.indexOf(tone) + 1) % TONES.length];

/**
 * Edita as situações das dívidas (Em aberto, Negociada, Abandonada…): renomear, trocar a cor,
 * criar e apagar. Só apaga situação sem dívidas; a padrão das dívidas novas nunca é apagada.
 */
export function DebtStatusesDialog({ open, onClose }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const settings = useFinanceStore((s) => s.settings);
  const debts = useFinanceStore((s) => s.debts);
  const updateSettings = useFinanceStore((s) => s.updateSettings);

  const [rows, setRows] = useState<DebtStatusOption[]>([]);
  const [newLabel, setNewLabel] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const dlg = dialogRef.current;
    if (!dlg) return;
    if (open && !dlg.open) dlg.showModal();
    if (!open && dlg.open) dlg.close();
  }, [open]);

  if (useOpenedWith(open)) {
    setRows(settings.debtStatuses);
    setNewLabel('');
    setError(null);
  }

  const inUse = (id: string) => debts.filter((d) => d.status === id).length;
  const patch = (id: string, change: Partial<DebtStatusOption>) =>
    setRows((list) => list.map((r) => (r.id === id ? { ...r, ...change } : r)));

  function addRow() {
    const label = newLabel.trim();
    if (!label) return;
    setRows((list) => [...list, { id: newStatusId(), label, tone: TONES[list.length % TONES.length] }]);
    setNewLabel('');
  }

  function removeRow(row: DebtStatusOption) {
    const count = inUse(row.id);
    if (count > 0) {
      return setError(`"${row.label}" tem ${count} dívida(s). Mude a situação delas antes de apagar.`);
    }
    setError(null);
    setRows((list) => list.filter((r) => r.id !== row.id));
  }

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const cleaned = rows.map((r) => ({ ...r, label: r.label.trim() }));
    if (cleaned.some((r) => !r.label)) return setError('Toda situação precisa de um nome.');
    const names = cleaned.map((r) => normalizeCategoryName(r.label));
    if (new Set(names).size !== names.length) return setError('Há duas situações com o mesmo nome.');

    const ids = new Set(cleaned.map((r) => r.id));
    const known = new Set(settings.debtStatuses.map((s) => s.id));
    // Situação nova entra no dashboard por padrão; apagada sai da preferência.
    const dashboard = [
      ...settings.dashboardDebtStatuses.filter((id) => ids.has(id)),
      ...cleaned.filter((r) => !known.has(r.id)).map((r) => r.id),
    ];
    updateSettings({ debtStatuses: cleaned, dashboardDebtStatuses: dashboard });
    onClose();
  }

  return (
    <dialog ref={dialogRef} className="modal modal-bottom sm:modal-middle" onClose={onClose} onCancel={onClose}>
      <div className="modal-box max-w-lg">
        <h3 className="text-lg font-bold">Situações das dívidas</h3>
        <p className="text-base-content/60 mt-1 text-sm">
          Renomeie, troque a cor (toque no quadrado) ou crie situações como &quot;Em negociação&quot;.
        </p>

        <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-3">
          <ul className="flex flex-col gap-2">
            {rows.map((r) => {
              const count = inUse(r.id);
              const isDefault = r.id === DEFAULT_DEBT_STATUS;
              return (
                <li key={r.id} className="flex items-center gap-2">
                  <button
                    type="button"
                    className={`h-11 w-11 shrink-0 rounded-xl ${TONE_CLASS[r.tone]}`}
                    aria-label={`Trocar a cor de ${r.label}`}
                    onClick={() => patch(r.id, { tone: nextTone(r.tone) })}
                  />
                  <div className="min-w-0 flex-1">
                    <input
                      className="input input-bordered w-full"
                      aria-label="Nome da situação"
                      value={r.label}
                      maxLength={40}
                      onChange={(e) => patch(r.id, { label: e.target.value })}
                    />
                    <span className="text-base-content/50 text-xs">
                      {count} dívida(s){isDefault && ' · situação das dívidas novas'}
                    </span>
                  </div>
                  <button
                    type="button"
                    className="btn btn-ghost btn-square min-h-11 min-w-11 text-error"
                    aria-label={`Apagar ${r.label}`}
                    disabled={isDefault}
                    onClick={() => removeRow(r)}
                  >
                    <Trash2 className="h-4 w-4" aria-hidden />
                  </button>
                </li>
              );
            })}
          </ul>

          <div className="join w-full">
            <input
              className="input input-bordered join-item min-w-0 flex-1"
              placeholder="Nova situação, ex: Em negociação"
              aria-label="Nome da nova situação"
              value={newLabel}
              maxLength={40}
              onChange={(e) => setNewLabel(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  addRow();
                }
              }}
            />
            <button type="button" className="btn btn-neutral join-item" onClick={addRow} disabled={!newLabel.trim()}>
              <Plus className="h-5 w-5" aria-hidden /> Criar
            </button>
          </div>

          {error && (
            <div role="alert" className="alert alert-error">
              <span>{error}</span>
            </div>
          )}

          <div className="modal-action mt-2">
            <button type="button" className="btn btn-ghost" onClick={onClose}>
              Cancelar
            </button>
            <button type="submit" className="btn btn-primary">
              Salvar
            </button>
          </div>
        </form>
      </div>
      <form method="dialog" className="modal-backdrop">
        <button>fechar</button>
      </form>
    </dialog>
  );
}
