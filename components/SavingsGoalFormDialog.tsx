'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';

import { parseAmount } from '@/lib/import/statement';
import { useFinanceStore } from '@/lib/store';
import type { Currency, SavingsGoal } from '@/types/finance';

type Props = {
  open: boolean;
  onClose: () => void;
  initial?: SavingsGoal;
};

const LOCK_OPTIONS = [7, 30, 90];

export function SavingsGoalFormDialog({ open, onClose, initial }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const addSavingsGoal = useFinanceStore((s) => s.addSavingsGoal);
  const updateSavingsGoal = useFinanceStore((s) => s.updateSavingsGoal);

  const [name, setName] = useState('');
  const [target, setTarget] = useState('');
  const [deadline, setDeadline] = useState('');
  const [institution, setInstitution] = useState('');
  const [currency, setCurrency] = useState<Currency>('BRL');
  const [cdiPercent, setCdiPercent] = useState('');
  const [lockDays, setLockDays] = useState('');
  const [depositDate, setDepositDate] = useState('');
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
    setTarget(initial ? String(initial.targetAmount).replace('.', ',') : '');
    setDeadline(initial?.deadline ?? '');
    setInstitution(initial?.institution ?? '');
    setCurrency(initial?.currency ?? 'BRL');
    setCdiPercent(initial?.cdiPercent != null ? String(initial.cdiPercent) : '');
    setLockDays(initial?.lockDays != null ? String(initial.lockDays) : '');
    setDepositDate(initial?.depositDate ?? '');
    setError(null);
  }, [open, initial]);

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!name.trim()) return setError('Nome obrigatório.');
    const targetNum = parseAmount(target);
    if (targetNum === null || targetNum <= 0)
      return setError('Valor da meta deve ser maior que zero.');
    const cdi = cdiPercent.trim() ? parseAmount(cdiPercent) : null;
    if (cdi !== null && (cdi < 0 || cdi > 1000)) return setError('% do CDI inválido.');
    const lock = lockDays.trim() ? Number(lockDays) : null;
    if (lock !== null && (!Number.isInteger(lock) || lock < 1))
      return setError('Prazo de resgate inválido.');

    const fields = {
      name: name.trim(),
      targetAmount: targetNum,
      deadline: deadline || null,
      institution: institution.trim() || null,
      currency,
      // Dólar não rende CDI: o campo some e é limpo.
      cdiPercent: currency === 'BRL' ? cdi : null,
      lockDays: lock,
      depositDate: lock ? depositDate || null : null,
    };
    if (initial) updateSavingsGoal(initial.id, fields);
    else addSavingsGoal(fields);
    onClose();
  }

  const symbol = currency === 'USD' ? 'US$' : 'R$';

  return (
    <dialog
      ref={dialogRef}
      className="modal modal-bottom sm:modal-middle"
      onClose={onClose}
      onCancel={onClose}
    >
      <div className="modal-box max-w-md">
        <h3 className="text-lg font-bold">{initial ? 'Editar caixinha' : 'Nova caixinha'}</h3>
        <form onSubmit={handleSubmit} className="mt-4 grid gap-3">
          <label className="form-control">
            <span className="label-text">Nome</span>
            <input
              className="input input-bordered w-full"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Reserva de emergência"
              maxLength={60}
              required
            />
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="form-control">
              <span className="label-text">Onde está</span>
              <input
                className="input input-bordered w-full"
                value={institution}
                onChange={(e) => setInstitution(e.target.value)}
                placeholder="Ex: Inter"
                maxLength={60}
              />
            </label>
            <label className="form-control">
              <span className="label-text">Moeda</span>
              <select
                className="select select-bordered w-full"
                value={currency}
                onChange={(e) => setCurrency(e.target.value as Currency)}
              >
                <option value="BRL">Real (R$)</option>
                <option value="USD">Dólar (US$)</option>
              </select>
            </label>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <label className="form-control">
              <span className="label-text">Meta ({symbol})</span>
              <input
                className="input input-bordered w-full"
                inputMode="decimal"
                value={target}
                onChange={(e) => setTarget(e.target.value)}
                placeholder="0,00"
                required
              />
            </label>
            {currency === 'BRL' && (
              <label className="form-control">
                <span className="label-text">Rende (% do CDI)</span>
                <input
                  className="input input-bordered w-full"
                  inputMode="decimal"
                  value={cdiPercent}
                  onChange={(e) => setCdiPercent(e.target.value)}
                  placeholder="Ex: 100"
                />
              </label>
            )}
          </div>

          <fieldset className="grid gap-2">
            <legend className="label-text mb-1">Prazo de resgate</legend>
            <div className="flex flex-wrap gap-2">
              {[
                { label: 'Livre', value: '' },
                ...LOCK_OPTIONS.map((d) => ({ label: `${d} dias`, value: String(d) })),
              ].map((o) => (
                <button
                  key={o.label}
                  type="button"
                  className={`btn btn-sm rounded-full ${lockDays === o.value ? 'btn-neutral' : 'btn-ghost bg-base-200'}`}
                  onClick={() => setLockDays(o.value)}
                >
                  {o.label}
                </button>
              ))}
              <input
                className="input input-bordered input-sm w-24"
                inputMode="numeric"
                aria-label="Outro prazo em dias"
                placeholder="Outro"
                value={LOCK_OPTIONS.map(String).includes(lockDays) ? '' : lockDays}
                onChange={(e) => setLockDays(e.target.value.replace(/\D/g, ''))}
              />
            </div>
            {lockDays && (
              <label className="form-control">
                <span className="label-text">Dia em que colocou o dinheiro</span>
                <input
                  type="date"
                  className="input input-bordered w-full"
                  value={depositDate}
                  onChange={(e) => setDepositDate(e.target.value)}
                />
                <span className="text-base-content/60 mt-1 text-xs">
                  Cada depósito pela caixinha atualiza essa data para o dia do depósito.
                </span>
              </label>
            )}
          </fieldset>

          <label className="form-control">
            <span className="label-text">Prazo da meta (opcional)</span>
            <input
              type="date"
              className="input input-bordered w-full"
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
