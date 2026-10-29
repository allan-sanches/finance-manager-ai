'use client';

import { useState } from 'react';

import { SavingsGoalFormDialog } from '@/components/SavingsGoalFormDialog';
import { BRL } from '@/lib/finance';
import { useFinanceStore } from '@/lib/store';
import { useHydrated } from '@/lib/useHydratedStore';
import type { SavingsGoal } from '@/types/finance';

export default function CaixinhasPage() {
  const hydrated = useHydrated();
  const goals = useFinanceStore((s) => s.savingsGoals);
  const depositToGoal = useFinanceStore((s) => s.depositToGoal);
  const withdrawFromGoal = useFinanceStore((s) => s.withdrawFromGoal);
  const removeSavingsGoal = useFinanceStore((s) => s.removeSavingsGoal);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<SavingsGoal | undefined>(undefined);

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold md:text-3xl">Caixinhas</h1>
          <p className="text-base-content/60 text-sm">
            Metas financeiras com barra de progresso — reservas, objetivos e fundos específicos.
          </p>
        </div>
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => {
            setEditing(undefined);
            setDialogOpen(true);
          }}
        >
          + Nova caixinha
        </button>
      </header>

      {!hydrated ? (
        <p className="text-base-content/60 text-sm">Carregando…</p>
      ) : goals.length === 0 ? (
        <div className="card border-base-300 border-2 border-dashed">
          <div className="card-body items-center justify-center text-center">
            <p className="text-base-content/60">Nenhuma caixinha criada ainda.</p>
            <button
              type="button"
              className="btn btn-primary btn-sm mt-2"
              onClick={() => setDialogOpen(true)}
            >
              + Criar primeira meta
            </button>
          </div>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {goals.map((g) => (
            <GoalCard
              key={g.id}
              goal={g}
              onDeposit={(amount) => depositToGoal(g.id, amount)}
              onWithdraw={(amount) => withdrawFromGoal(g.id, amount)}
              onEdit={() => {
                setEditing(g);
                setDialogOpen(true);
              }}
              onDelete={() => {
                if (confirm(`Excluir caixinha "${g.name}"?`)) removeSavingsGoal(g.id);
              }}
            />
          ))}
        </div>
      )}

      <SavingsGoalFormDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        initial={editing}
      />
    </div>
  );
}

function GoalCard({
  goal,
  onDeposit,
  onWithdraw,
  onEdit,
  onDelete,
}: {
  goal: SavingsGoal;
  onDeposit: (amount: number) => void;
  onWithdraw: (amount: number) => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const [amountInput, setAmountInput] = useState('');
  const pct = Math.min(100, Math.round((goal.currentAmount / Math.max(1, goal.targetAmount)) * 100));
  const done = goal.currentAmount >= goal.targetAmount;

  function handleApply(direction: 'in' | 'out') {
    const v = Number(amountInput.replace(',', '.'));
    if (!Number.isFinite(v) || v <= 0) return;
    if (direction === 'in') onDeposit(v);
    else onWithdraw(v);
    setAmountInput('');
  }

  return (
    <article className="card bg-base-200 shadow">
      <div className="card-body">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h2 className="card-title">{goal.name}</h2>
            {goal.deadline && (
              <p className="text-base-content/60 text-xs">Até {goal.deadline}</p>
            )}
          </div>
          {done && <span className="badge badge-success">Meta atingida</span>}
        </div>

        <p className="text-base-content/70 text-sm">
          {BRL.format(goal.currentAmount)} de {BRL.format(goal.targetAmount)}
        </p>
        <progress
          className={`progress w-full ${done ? 'progress-success' : 'progress-primary'}`}
          value={pct}
          max={100}
          aria-label={`Progresso da meta ${goal.name}`}
        />
        <div className="text-base-content/60 text-xs">{pct}% concluído</div>

        <div className="join mt-2 w-full">
          <input
            className="input input-bordered input-sm join-item w-full"
            inputMode="decimal"
            placeholder="R$ 0,00"
            value={amountInput}
            onChange={(e) => setAmountInput(e.target.value)}
          />
          <button
            type="button"
            className="btn btn-success btn-sm join-item"
            onClick={() => handleApply('in')}
            disabled={!amountInput}
          >
            + Depositar
          </button>
          <button
            type="button"
            className="btn btn-warning btn-sm join-item"
            onClick={() => handleApply('out')}
            disabled={!amountInput || goal.currentAmount === 0}
          >
            − Sacar
          </button>
        </div>

        <div className="card-actions justify-end">
          <button type="button" className="btn btn-ghost btn-xs" onClick={onEdit}>
            Editar
          </button>
          <button type="button" className="btn btn-ghost btn-xs text-error" onClick={onDelete}>
            Excluir
          </button>
        </div>
      </div>
    </article>
  );
}
