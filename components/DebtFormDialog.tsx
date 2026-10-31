'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';

import { MoneyInput } from '@/components/MoneyInput';
import { DEFAULT_DEBT_STATUS, todayISO } from '@/lib/finance';
import { parseAmount } from '@/lib/import/statement';
import { toMoneyInput } from '@/lib/money-mask';
import { useFinanceStore } from '@/lib/store';
import { useOpenedWith } from '@/lib/useMounted';
import type { Debt, DebtStatus } from '@/types/finance';

type Props = {
  open: boolean;
  onClose: () => void;
  /** Sem `initial`: cadastra uma dívida manual. Com: edita (as de relatório só mudam status e anotação). */
  initial?: Debt;
};

export function DebtFormDialog({ open, onClose, initial }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const addDebt = useFinanceStore((s) => s.addDebt);
  const updateDebt = useFinanceStore((s) => s.updateDebt);
  const removeDebt = useFinanceStore((s) => s.removeDebt);
  const statuses = useFinanceStore((s) => s.settings.debtStatuses);

  const [creditor, setCreditor] = useState('');
  const [description, setDescription] = useState('');
  const [current, setCurrent] = useState('');
  const [overdue, setOverdue] = useState('');
  const [status, setStatus] = useState<DebtStatus>(DEFAULT_DEBT_STATUS);
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Valores de relatório (Registrato/Serasa) vêm do banco/bureau: editar à mão seria sobrescrito
  // na próxima importação, então só o que é do usuário fica editável.
  const fromReport = initial && initial.source !== 'manual';

  useEffect(() => {
    const dlg = dialogRef.current;
    if (!dlg) return;
    if (open && !dlg.open) dlg.showModal();
    if (!open && dlg.open) dlg.close();
  }, [open]);

  if (useOpenedWith(open, initial)) {
    setCreditor(initial?.creditor ?? '');
    setDescription(initial?.description ?? '');
    setCurrent(toMoneyInput(initial?.currentAmount));
    setOverdue(toMoneyInput(initial?.overdueAmount));
    setStatus(initial?.status ?? DEFAULT_DEBT_STATUS);
    setNotes(initial?.notes ?? '');
    setError(null);
  }

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const cleanNotes = notes.trim() || null;
    if (fromReport && initial) {
      updateDebt(initial.id, { status, notes: cleanNotes });
      return onClose();
    }
    if (!creditor.trim() || !description.trim()) return setError('Informe credor e descrição.');
    const currentAmount = current.trim() ? parseAmount(current) : 0;
    const overdueAmount = overdue.trim() ? parseAmount(overdue) : 0;
    if (
      currentAmount === null ||
      overdueAmount === null ||
      currentAmount < 0 ||
      overdueAmount < 0
    ) {
      return setError('Valores inválidos.');
    }
    if (currentAmount + overdueAmount <= 0) return setError('Informe o valor da dívida.');

    const fields = {
      creditor: creditor.trim(),
      description: description.trim(),
      currentAmount,
      overdueAmount,
      status,
      notes: cleanNotes,
    };
    if (initial) updateDebt(initial.id, fields);
    else addDebt({ ...fields, referenceDate: todayISO() });
    onClose();
  }

  return (
    <dialog
      ref={dialogRef}
      className="modal modal-bottom sm:modal-middle"
      onClose={onClose}
      onCancel={onClose}
    >
      <div className="modal-box max-w-md">
        <h3 className="text-lg font-bold">
          {initial ? (fromReport ? initial.creditor : 'Editar dívida') : 'Nova dívida'}
        </h3>
        {fromReport && <p className="text-base-content/60 text-sm">{initial.description}</p>}

        <form onSubmit={handleSubmit} className="mt-4 grid gap-3">
          {!fromReport && (
            <>
              <label className="form-control">
                <span className="label-text">Credor</span>
                <input
                  className="input input-bordered w-full"
                  value={creditor}
                  onChange={(e) => setCreditor(e.target.value)}
                  placeholder="Ex: Simplic, Fulano"
                  maxLength={200}
                />
              </label>
              <label className="form-control">
                <span className="label-text">Descrição</span>
                <input
                  className="input input-bordered w-full"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Ex: Empréstimo, cartão, acerto"
                  maxLength={200}
                />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="form-control">
                  <span className="label-text">Em dia</span>
                  <MoneyInput value={current} onChange={setCurrent} />
                </label>
                <label className="form-control">
                  <span className="label-text">Vencida</span>
                  <MoneyInput value={overdue} onChange={setOverdue} />
                </label>
              </div>
            </>
          )}

          <fieldset>
            <legend className="label-text mb-2">Situação</legend>
            <div className="flex flex-wrap gap-2">
              {statuses.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  className={`btn btn-sm rounded-full ${status === s.id ? 'btn-neutral' : 'btn-ghost bg-base-200'}`}
                  onClick={() => setStatus(s.id)}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </fieldset>

          <label className="form-control">
            <span className="label-text">Anotações</span>
            <textarea
              className="textarea textarea-bordered w-full"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ex: Oferta de R$ 800 à vista no Serasa Limpa Nome"
              maxLength={500}
              rows={3}
            />
          </label>

          {error && (
            <div role="alert" className="alert alert-error">
              <span>{error}</span>
            </div>
          )}

          <div className="modal-action mt-2">
            {initial && (
              <button
                type="button"
                className="btn btn-ghost text-error mr-auto"
                onClick={() => {
                  if (!confirm(`Remover a dívida de ${initial.creditor}?`)) return;
                  removeDebt(initial.id);
                  onClose();
                }}
              >
                Excluir
              </button>
            )}
            <button type="button" className="btn btn-ghost" onClick={onClose}>
              Cancelar
            </button>
            <button type="submit" className="btn btn-primary">
              {initial ? 'Salvar' : 'Adicionar'}
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
