'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';

import { BRL, todayISO } from '@/lib/finance';
import { parseAmount } from '@/lib/import/statement';
import { goalRateAt, monthlyRateFromCdi, projectGoal, SAVINGS_BANKS, USD } from '@/lib/savings';
import { useFinanceStore } from '@/lib/store';
import { useOpenedWith } from '@/lib/useMounted';
import { useCdi } from '@/lib/useCdi';
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
  const [contribution, setContribution] = useState('');
  const [error, setError] = useState<string | null>(null);

  const cdi = useCdi();

  useEffect(() => {
    const dlg = dialogRef.current;
    if (!dlg) return;
    if (open && !dlg.open) dlg.showModal();
    if (!open && dlg.open) dlg.close();
  }, [open]);

  if (useOpenedWith(open, initial)) {
    setName(initial?.name ?? '');
    setTarget(initial ? String(initial.targetAmount).replace('.', ',') : '');
    setDeadline(initial?.deadline ?? '');
    setInstitution(initial?.institution ?? '');
    setCurrency(initial?.currency ?? 'BRL');
    setCdiPercent(initial?.cdiPercent != null ? String(initial.cdiPercent) : '');
    setLockDays(initial?.lockDays != null ? String(initial.lockDays) : '');
    setDepositDate(initial?.depositDate ?? '');
    setContribution(
      initial?.monthlyContribution ? String(initial.monthlyContribution).replace('.', ',') : '',
    );
    setError(null);
  }

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
    const monthly = contribution.trim() ? parseAmount(contribution) : null;
    if (monthly !== null && monthly < 0) return setError('Aporte mensal inválido.');

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
      monthlyContribution: monthly || null,
    };
    if (initial) updateSavingsGoal(initial.id, fields);
    else addSavingsGoal(fields);
    onClose();
  }

  const symbol = currency === 'USD' ? 'US$' : 'R$';
  const money = currency === 'USD' ? USD : BRL;
  const cdiNum = currency === 'BRL' && cdiPercent.trim() ? parseAmount(cdiPercent) : null;

  // Prévia com o que está digitado, a partir do saldo atual da caixinha.
  const preview = (() => {
    const targetNum = parseAmount(target);
    if (targetNum === null || targetNum <= 0) return null;
    const draft = {
      id: '',
      name,
      targetAmount: targetNum,
      currentAmount: initial?.currentAmount ?? 0,
      currency,
      cdiPercent: cdiNum,
      deadline: deadline || null,
      monthlyContribution: contribution.trim() ? parseAmount(contribution) : null,
    };
    const today = todayISO();
    const rateAt = goalRateAt(draft, cdi, today);
    return rateAt === null ? null : projectGoal(draft, rateAt, today);
  })();

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

          {currency === 'BRL' && (
            <fieldset className="grid gap-2">
              <legend className="label-text mb-1">Banco</legend>
              <div className="grid grid-cols-2 gap-2">
                {SAVINGS_BANKS.map((b) => {
                  const selected = institution === b.name && cdiNum === b.cdiPercent;
                  const annual = cdi
                    ? ((1 + monthlyRateFromCdi(b.cdiPercent, cdi.annualRate)) ** 12 - 1) * 100
                    : null;
                  return (
                    <button
                      key={b.name}
                      type="button"
                      aria-pressed={selected}
                      className={`btn h-auto min-h-12 flex-col gap-0 py-2 ${selected ? 'btn-neutral' : 'btn-ghost bg-base-200'}`}
                      onClick={() => {
                        setInstitution(b.name);
                        setCdiPercent(String(b.cdiPercent));
                      }}
                    >
                      <span className="font-bold">{b.name}</span>
                      <span className="text-xs font-normal opacity-80">
                        {b.cdiPercent}% do CDI
                        {annual !== null &&
                          ` · ≈ ${annual.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}% a.a.`}
                      </span>
                    </button>
                  );
                })}
              </div>
            </fieldset>
          )}

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

          <div className="grid grid-cols-2 gap-3">
            <label className="form-control">
              <span className="label-text">Aporte por mês ({symbol})</span>
              <input
                className="input input-bordered w-full"
                inputMode="decimal"
                value={contribution}
                onChange={(e) => setContribution(e.target.value)}
                placeholder="Opcional"
              />
            </label>
            <label className="form-control">
              <span className="label-text">Prazo da meta</span>
              <input
                type="date"
                className="input input-bordered w-full"
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
              />
            </label>
          </div>

          {preview && (preview.atDeadline || preview.reachDate) && (
            <div className="bg-base-200 rounded-box flex flex-col gap-1 p-3 text-sm">
              {preview.atDeadline && (
                <>
                  <span>
                    No prazo: <strong>{money.format(preview.atDeadline.amount)}</strong> líquido
                    {preview.atDeadline.yieldAmount > 0.005 &&
                      ` (${money.format(preview.atDeadline.yieldAmount)} de rendimento já sem IR)`}
                  </span>
                  <span>
                    {preview.atDeadline.requiredContribution === 0
                      ? 'Chega na meta só com o que já está guardado.'
                      : `Para bater a meta: ${money.format(preview.atDeadline.requiredContribution)}/mês.`}
                  </span>
                </>
              )}
              {preview.reachDate && (
                <span>Meta batida em {formatMonth(preview.reachDate)} nesse ritmo.</span>
              )}
            </div>
          )}

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

function formatMonth(iso: string): string {
  const [y, m] = iso.split('-');
  return `${m}/${y}`;
}
