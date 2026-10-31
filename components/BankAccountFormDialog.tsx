'use client';

import { Trash2 } from 'lucide-react';
import { useEffect, useRef, useState, type FormEvent } from 'react';

import { MoneyInput } from '@/components/MoneyInput';
import { todayISO } from '@/lib/finance';
import { parseMoneyInput, toMoneyInput } from '@/lib/money-mask';
import { useFinanceStore } from '@/lib/store';
import { useOpenedWith } from '@/lib/useMounted';
import type { BankAccount } from '@/types/finance';

type Props = {
  open: boolean;
  onClose: () => void;
  initial?: BankAccount;
  /** Nome já preenchido ao criar pelos atalhos (ex.: "Inter"). */
  presetName?: string;
};

export function BankAccountFormDialog({ open, onClose, initial, presetName }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const addBankAccount = useFinanceStore((s) => s.addBankAccount);
  const updateBankAccount = useFinanceStore((s) => s.updateBankAccount);
  const removeBankAccount = useFinanceStore((s) => s.removeBankAccount);

  const [name, setName] = useState('');
  const [balance, setBalance] = useState('');
  const [negative, setNegative] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const dlg = dialogRef.current;
    if (!dlg) return;
    if (open && !dlg.open) dlg.showModal();
    if (!open && dlg.open) dlg.close();
  }, [open]);

  if (useOpenedWith(open, initial, presetName)) {
    setName(initial?.name ?? presetName ?? '');
    setBalance(toMoneyInput(initial ? Math.abs(initial.balance) : undefined));
    setNegative((initial?.balance ?? 0) < 0);
    setError(null);
  }

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!name.trim()) return setError('Nome obrigatório.');
    const abs = parseMoneyInput(balance) ?? 0;
    const value = negative ? -abs : abs;

    if (initial) {
      updateBankAccount(initial.id, {
        name: name.trim(),
        balance: value,
        // Só um saldo novo muda a data de atualização; renomear não.
        ...(value !== initial.balance ? { balanceDate: todayISO() } : {}),
      });
    } else {
      addBankAccount({ name: name.trim(), balance: value, balanceDate: todayISO() });
    }
    onClose();
  }

  function handleRemove() {
    if (!initial) return;
    if (!confirm(`Excluir a conta "${initial.name}"?`)) return;
    removeBankAccount(initial.id);
    onClose();
  }

  return (
    <dialog ref={dialogRef} className="modal modal-bottom sm:modal-middle" onClose={onClose} onCancel={onClose}>
      <div className="modal-box max-w-md">
        <h3 className="text-lg font-bold">{initial ? 'Editar conta' : 'Nova conta'}</h3>
        <form onSubmit={handleSubmit} className="mt-4 grid gap-3">
          <label className="form-control">
            <span className="label-text">Nome</span>
            <input
              className="input input-bordered"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Inter, Mercado Pago"
              maxLength={60}
              required
            />
          </label>

          <label className="form-control">
            <span className="label-text">Saldo atual</span>
            <MoneyInput value={balance} onChange={setBalance} autoFocus={Boolean(initial || presetName)} />
          </label>

          <label className="flex min-h-11 cursor-pointer items-center gap-3">
            <input
              type="checkbox"
              className="checkbox"
              checked={negative}
              onChange={(e) => setNegative(e.target.checked)}
            />
            <span className="label-text">Saldo negativo (cheque especial)</span>
          </label>

          {error && (
            <div role="alert" className="alert alert-error">
              <span>{error}</span>
            </div>
          )}

          <div className="modal-action mt-2">
            {initial && (
              <button type="button" className="btn btn-ghost text-error mr-auto" onClick={handleRemove}>
                <Trash2 className="h-4 w-4" aria-hidden /> Excluir
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
