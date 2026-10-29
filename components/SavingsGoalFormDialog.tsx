'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';

import { useFinanceStore } from '@/lib/store';
import type { SavingsGoal } from '@/types/finance';

type Props = {
  open: boolean;
  onClose: () => void;
  initial?: SavingsGoal;
};

export function SavingsGoalFormDialog({ open, onClose, initial }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const addSavingsGoal = useFinanceStore((s) => s.addSavingsGoal);
  const updateSavingsGoal = useFinanceStore((s) => s.updateSavingsGoal);

  const [name, setName] = useState('');
  const [target, setTarget] = useState('');
  const [deadline, setDeadline] = useState('');
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
    setTarget(initial ? String(initial.targetAmount) : '');
    setDeadline(initial?.deadline ?? '');
    setError(null);
  }, [open, initial]);

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!name.trim()) return setError('Nome obrigatório.');
    const targetNum = Number(target.replace(',', '.'));
    if (!Number.isFinite(targetNum) || targetNum <= 0) {
      return setError('Valor da meta deve ser maior que zero.');
    }
    const cleanedDeadline = deadline.trim() || null;
    if (cleanedDeadline && !/^\d{4}-\d{2}-\d{2}$/.test(cleanedDeadline)) {
      return setError('Prazo inválido.');
    }

    if (initial) {
      updateSavingsGoal(initial.id, {
        name: name.trim(),
        targetAmount: targetNum,
        deadline: cleanedDeadline,
      });
    } else {
      addSavingsGoal({
        name: name.trim(),
        targetAmount: targetNum,
        deadline: cleanedDeadline,
      });
    }
    onClose();
  }

  return (
    <dialog ref={dialogRef} className="modal" onClose={onClose} onCancel={onClose}>
      <div className="modal-box max-w-md">
        <h3 className="text-lg font-bold">
          {initial ? 'Editar caixinha' : 'Nova caixinha'}
        </h3>
        <form onSubmit={handleSubmit} className="mt-4 grid gap-3">
          <label className="form-control">
            <span className="label-text">Nome</span>
            <input
              className="input input-bordered"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Reserva de emergência"
              maxLength={60}
              required
            />
          </label>

          <label className="form-control">
            <span className="label-text">Valor da meta (R$)</span>
            <input
              className="input input-bordered"
              inputMode="decimal"
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              placeholder="0,00"
              required
            />
          </label>

          <label className="form-control">
            <span className="label-text">Prazo (opcional)</span>
            <input
              type="date"
              className="input input-bordered"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
            />
          </label>

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
              {initial ? 'Salvar' : 'Criar'}
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
