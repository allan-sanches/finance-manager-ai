'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';

import { useFinanceStore } from '@/lib/store';
import type { CreditCard } from '@/types/finance';

type Props = {
  open: boolean;
  onClose: () => void;
  initial?: CreditCard;
};

export function CreditCardFormDialog({ open, onClose, initial }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const addCreditCard = useFinanceStore((s) => s.addCreditCard);
  const updateCreditCard = useFinanceStore((s) => s.updateCreditCard);

  const [name, setName] = useState('');
  const [limit, setLimit] = useState('');
  const [closingDay, setClosingDay] = useState('1');
  const [dueDay, setDueDay] = useState('10');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const dlg = dialogRef.current;
    if (!dlg) return;
    if (open && !dlg.open) dlg.showModal();
    if (!open && dlg.open) dlg.close();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    setName(initial?.name ?? '');
    setLimit(initial ? String(initial.limit) : '');
    setClosingDay(initial ? String(initial.closingDay) : '1');
    setDueDay(initial ? String(initial.dueDay) : '10');
    setError(null);
  }, [open, initial]);

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!name.trim()) return setError('Nome obrigatório.');
    const limitNum = Number(limit.replace(',', '.'));
    if (!Number.isFinite(limitNum) || limitNum <= 0) return setError('Limite inválido.');
    const closing = Number(closingDay);
    const due = Number(dueDay);
    if (!Number.isInteger(closing) || closing < 1 || closing > 28) {
      return setError('Dia de fechamento deve ser entre 1 e 28.');
    }
    if (!Number.isInteger(due) || due < 1 || due > 28) {
      return setError('Dia de vencimento deve ser entre 1 e 28.');
    }

    if (initial) {
      updateCreditCard(initial.id, {
        name: name.trim(),
        limit: limitNum,
        closingDay: closing,
        dueDay: due,
      });
    } else {
      addCreditCard({
        name: name.trim(),
        limit: limitNum,
        closingDay: closing,
        dueDay: due,
        currentInvoiceAmount: 0,
      });
    }
    onClose();
  }

  return (
    <dialog ref={dialogRef} className="modal" onClose={onClose} onCancel={onClose}>
      <div className="modal-box max-w-md">
        <h3 className="text-lg font-bold">
          {initial ? 'Editar cartão' : 'Novo cartão de crédito'}
        </h3>
        <form onSubmit={handleSubmit} className="mt-4 grid gap-3">
          <label className="form-control">
            <span className="label-text">Nome</span>
            <input
              className="input input-bordered"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Nubank"
              maxLength={40}
              required
            />
          </label>

          <label className="form-control">
            <span className="label-text">Limite total (R$)</span>
            <input
              className="input input-bordered"
              inputMode="decimal"
              value={limit}
              onChange={(e) => setLimit(e.target.value)}
              placeholder="0,00"
              required
            />
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="form-control">
              <span className="label-text">Dia de fechamento</span>
              <input
                type="number"
                min={1}
                max={28}
                className="input input-bordered"
                value={closingDay}
                onChange={(e) => setClosingDay(e.target.value)}
                required
              />
            </label>
            <label className="form-control">
              <span className="label-text">Dia de vencimento</span>
              <input
                type="number"
                min={1}
                max={28}
                className="input input-bordered"
                value={dueDay}
                onChange={(e) => setDueDay(e.target.value)}
                required
              />
            </label>
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
