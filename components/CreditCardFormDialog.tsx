'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';

import { MoneyInput } from '@/components/MoneyInput';
import { BRL, cardLimit, cardUsage, todayISO } from '@/lib/finance';
import { parseMoneyInput, toMoneyInput } from '@/lib/money-mask';
import { useFinanceStore } from '@/lib/store';
import { useOpenedWith } from '@/lib/useMounted';
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
  // Só caixinhas em reais podem garantir limite (o cartão é em R$).
  const allGoals = useFinanceStore((s) => s.savingsGoals);
  const goals = allGoals.filter((g) => g.currency === 'BRL');
  const transactions = useFinanceStore((s) => s.transactions);
  const invoices = useFinanceStore((s) => s.creditCardInvoices);

  const [name, setName] = useState('');
  const [limit, setLimit] = useState('');
  const [limitGoalId, setLimitGoalId] = useState('');
  const [securedLimit, setSecuredLimit] = useState(false);
  const [closingDay, setClosingDay] = useState('1');
  const [dueDay, setDueDay] = useState('10');
  const [cdiPercent, setCdiPercent] = useState('');
  // Limite usado como o banco mostra (opcional): vira a referência do uso do limite.
  const [used, setUsed] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const dlg = dialogRef.current;
    if (!dlg) return;
    if (open && !dlg.open) dlg.showModal();
    if (!open && dlg.open) dlg.close();
  }, [open]);

  if (useOpenedWith(open, initial)) {
    setName(initial?.name ?? '');
    // Limite garantido: mostra o valor de hoje (o conferido + aplicações e resgates depois dele).
    setLimit(toMoneyInput(initial ? cardLimit({ ...initial, limitSavingsGoalId: null }, [], transactions) : undefined));
    setLimitGoalId(initial?.limitSavingsGoalId ?? '');
    setSecuredLimit(Boolean(initial?.securedLimit));
    setClosingDay(initial ? String(initial.closingDay) : '1');
    setDueDay(initial ? String(initial.dueDay) : '10');
    setCdiPercent(initial?.cdiPercent != null ? String(initial.cdiPercent) : '');
    setUsed(
      initial?.usedDate
        ? toMoneyInput(cardUsage(initial.id, transactions, invoices, todayISO(), initial).used)
        : '',
    );
    setError(null);
  }

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!name.trim()) return setError('Nome obrigatório.');
    const goal = goals.find((g) => g.id === limitGoalId);
    // Com caixinha, o limite fixo vira só o último saldo conhecido (usado se a caixinha for apagada).
    const limitNum = goal ? goal.currentAmount : (parseMoneyInput(limit) ?? 0);
    if (!goal && (!Number.isFinite(limitNum) || limitNum <= 0)) return setError('Limite inválido.');
    const closing = Number(closingDay);
    const due = Number(dueDay);
    if (!Number.isInteger(closing) || closing < 1 || closing > 28) {
      return setError('Dia de fechamento deve ser entre 1 e 28.');
    }
    if (!Number.isInteger(due) || due < 1 || due > 28) {
      return setError('Dia de vencimento deve ser entre 1 e 28.');
    }
    const cdi = cdiPercent.trim() ? Number(cdiPercent.replace(',', '.')) : null;
    if (cdi != null && (!Number.isFinite(cdi) || cdi < 0 || cdi > 1000)) return setError('% do CDI inválido.');
    const usedNum = used.trim() ? parseMoneyInput(used) : null;
    const bank = {
      cdiPercent: securedLimit && !goal ? cdi : null,
      usedAmount: usedNum,
      usedDate: usedNum != null ? todayISO() : null,
    };

    if (initial) {
      updateCreditCard(initial.id, {
        name: name.trim(),
        limit: limitNum,
        limitSavingsGoalId: goal?.id ?? null,
        securedLimit,
        // Salvar confere o valor hoje: só as movimentações daqui para frente mudam o limite.
        limitDate: securedLimit && !goal ? todayISO() : null,
        ...bank,
        closingDay: closing,
        dueDay: due,
      });
    } else {
      addCreditCard({
        name: name.trim(),
        limit: limitNum,
        limitSavingsGoalId: goal?.id ?? null,
        securedLimit,
        limitDate: securedLimit && !goal ? todayISO() : null,
        ...bank,
        closingDay: closing,
        dueDay: due,
        currentInvoiceAmount: 0,
      });
    }
    onClose();
  }

  return (
    <dialog ref={dialogRef} className="modal modal-bottom sm:modal-middle" onClose={onClose} onCancel={onClose}>
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

          {goals.length > 0 && (
            <label className="form-control">
              <span className="label-text">De onde vem o limite</span>
              <select
                className="select select-bordered"
                value={limitGoalId}
                onChange={(e) => setLimitGoalId(e.target.value)}
              >
                <option value="">Valor fixo</option>
                {goals.map((g) => (
                  <option key={g.id} value={g.id}>
                    Saldo da caixinha {g.name}
                  </option>
                ))}
              </select>
            </label>
          )}

          {limitGoalId && goals.some((g) => g.id === limitGoalId) ? (
            <p className="text-base-content/70 text-sm">
              O limite acompanha o saldo da caixinha: hoje{' '}
              <strong>{BRL.format(goals.find((g) => g.id === limitGoalId)?.currentAmount ?? 0)}</strong>.
            </p>
          ) : (
            <label className="form-control">
              <span className="label-text">{securedLimit ? 'Valor do investimento hoje (limite)' : 'Limite total'}</span>
              <MoneyInput value={limit} onChange={setLimit} required />
              {securedLimit && (
                <span className="text-base-content/60 mt-1 text-xs">
                  Daqui para frente, aplicações no investimento ligadas ao cartão aumentam o limite e
                  resgates diminuem.
                </span>
              )}
            </label>
          )}

          <label className="label cursor-pointer items-start justify-start gap-3">
            <input
              type="checkbox"
              className="checkbox checkbox-primary mt-0.5"
              checked={securedLimit}
              onChange={(e) => setSecuredLimit(e.target.checked)}
            />
            <span className="label-text">
              Limite garantido (ex: CDB)
              <span className="text-base-content/60 block text-xs">
                Cada compra conta como gasto no dia em que foi feita. Pagar a fatura vira movimentação: só
                devolve o limite.
              </span>
            </span>
          </label>

          {securedLimit && !(limitGoalId && goals.some((g) => g.id === limitGoalId)) && (
            <label className="form-control">
              <span className="label-text">O investimento rende (% do CDI)</span>
              <input
                className="input input-bordered"
                inputMode="decimal"
                placeholder="Ex: 100"
                value={cdiPercent}
                onChange={(e) => setCdiPercent(e.target.value)}
              />
              <span className="text-base-content/60 mt-1 text-xs">
                O limite cresce todo dia útil com o rendimento, como no banco.
              </span>
            </label>
          )}

          <label className="form-control">
            <span className="label-text">Limite usado no banco (opcional)</span>
            <MoneyInput value={used} onChange={setUsed} />
            <span className="text-base-content/60 mt-1 text-xs">
              Copie do app do banco. Daí em diante, compras somam e faturas pagas descontam; juros de parcelas
              futuras não ocupam o limite, como no banco.
            </span>
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
