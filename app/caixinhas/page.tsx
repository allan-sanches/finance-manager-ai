'use client';

import { Pencil, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';

import { SavingsGoalFormDialog } from '@/components/SavingsGoalFormDialog';
import { EmptyState, PageHeader } from '@/components/ui';
import { BRL } from '@/lib/finance';
import { parseAmount } from '@/lib/import/statement';
import { useFinanceStore } from '@/lib/store';
import { TONE_CLASS, type Tone } from '@/lib/tones';
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
    <div className="mx-auto flex max-w-5xl flex-col">
      <PageHeader
        title="Caixinhas"
        subtitle="Reservas e objetivos, com o progresso de cada um."
        action={
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => {
              setEditing(undefined);
              setDialogOpen(true);
            }}
          >
            <Plus className="h-5 w-5" aria-hidden /> Nova caixinha
          </button>
        }
      />

      {!hydrated ? (
        <p className="text-base-content/60 text-sm">Carregando…</p>
      ) : goals.length === 0 ? (
        <EmptyState emoji="🐷" title="Nenhuma caixinha ainda">
          Crie uma meta — viagem, reserva de emergência, um desejo.
        </EmptyState>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {goals.map((g, i) => (
            <GoalCard
              key={g.id}
              goal={g}
              tone={GOAL_TONES[i % GOAL_TONES.length]}
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

const GOAL_TONES: Tone[] = ['violet', 'cyan', 'lime', 'pink', 'amber', 'sky'];

function GoalCard({
  goal,
  tone,
  onDeposit,
  onWithdraw,
  onEdit,
  onDelete,
}: {
  goal: SavingsGoal;
  tone: Tone;
  onDeposit: (amount: number) => void;
  onWithdraw: (amount: number) => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const [amountInput, setAmountInput] = useState('');
  const pct = Math.min(100, Math.round((goal.currentAmount / Math.max(1, goal.targetAmount)) * 100));
  const done = goal.currentAmount >= goal.targetAmount;
  const missing = Math.max(0, goal.targetAmount - goal.currentAmount);

  function handleApply(direction: 'in' | 'out') {
    const v = parseAmount(amountInput); // aceita "1.234,56" e "1234.56"
    if (v === null || v <= 0) return;
    if (direction === 'in') onDeposit(v);
    else onWithdraw(v);
    setAmountInput('');
  }

  return (
    <article className="panel flex flex-col overflow-hidden">
      <div className={`flex flex-col gap-3 p-4 ${TONE_CLASS[tone]}`}>
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h2 className="truncate text-lg font-extrabold">{goal.name}</h2>
            {goal.deadline && (
              <p className="text-xs font-semibold opacity-80">
                Até {goal.deadline.split('-').reverse().join('/')}
              </p>
            )}
          </div>
          {done ? (
            <span className="sticker bg-white">🎉 Meta batida</span>
          ) : (
            <span className="metric text-2xl">{pct}%</span>
          )}
        </div>
        <div>
          <p className="metric text-3xl">{BRL.format(goal.currentAmount)}</p>
          <p className="text-xs font-semibold opacity-80">
            de {BRL.format(goal.targetAmount)}
            {!done && ` · faltam ${BRL.format(missing)}`}
          </p>
        </div>
        <div className="h-2.5 overflow-hidden rounded-full bg-black/15" aria-hidden>
          <div className="h-full rounded-full bg-current" style={{ width: `${pct}%` }} />
        </div>
      </div>

      <div className="flex flex-col gap-2 p-4">
        <input
          className="input input-bordered w-full"
          inputMode="decimal"
          placeholder="Valor (R$)"
          aria-label={`Valor para ${goal.name}`}
          value={amountInput}
          onChange={(e) => setAmountInput(e.target.value)}
        />
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => handleApply('in')}
            disabled={!amountInput}
          >
            + Guardar
          </button>
          <button
            type="button"
            className="btn btn-outline"
            onClick={() => handleApply('out')}
            disabled={!amountInput || goal.currentAmount === 0}
          >
            − Tirar
          </button>
        </div>
        <div className="flex justify-end">
          <button type="button" className="btn btn-ghost btn-sm" onClick={onEdit}>
            <Pencil className="h-4 w-4" aria-hidden /> Editar
          </button>
          <button type="button" className="btn btn-ghost btn-sm text-error" onClick={onDelete}>
            <Trash2 className="h-4 w-4" aria-hidden /> Excluir
          </button>
        </div>
      </div>
    </article>
  );
}
