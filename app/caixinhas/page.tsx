'use client';

import {
  BellRing,
  CalendarClock,
  Lock,
  Pencil,
  PiggyBank,
  Plus,
  Target,
  Trash2,
  TrendingUp,
} from 'lucide-react';
import { useMemo, useState } from 'react';

import { MoneyInput } from '@/components/MoneyInput';
import { SavingsGoalFormDialog } from '@/components/SavingsGoalFormDialog';
import { EmptyState, PageHeader } from '@/components/ui';
import { BRL, todayISO } from '@/lib/finance';
import { parseMoneyInput } from '@/lib/money-mask';
import {
  daysBetween,
  estimatedMonthlyYield,
  goalRateAt,
  MATURITY_WARNING_DAYS,
  maturityAlerts,
  maturityLabel,
  projectGoal,
  redemptionDate,
  USD,
} from '@/lib/savings';
import { useFinanceStore } from '@/lib/store';
import { TONE_CLASS, type Tone } from '@/lib/tones';
import { useCdi, type Cdi } from '@/lib/useCdi';
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
  const cdi = useCdi();

  // Agrupa por instituição (Inter, Mercado Pago…); sem instituição vai para o fim.
  const groups = useMemo(() => {
    const map = new Map<string, SavingsGoal[]>();
    for (const g of goals) {
      const key = g.institution?.trim() || '';
      map.set(key, [...(map.get(key) ?? []), g]);
    }
    return [...map.entries()].sort(([a], [b]) =>
      a === '' ? 1 : b === '' ? -1 : a.localeCompare(b, 'pt-BR'),
    );
  }, [goals]);

  const totalBrl = goals
    .filter((g) => g.currency === 'BRL')
    .reduce((s, g) => s + g.currentAmount, 0);
  const totalUsd = goals
    .filter((g) => g.currency === 'USD')
    .reduce((s, g) => s + g.currentAmount, 0);
  const monthlyYield = cdi
    ? goals
        .filter((g) => g.currency === 'BRL')
        .reduce((s, g) => s + (estimatedMonthlyYield(g, cdi.annualRate) ?? 0), 0)
    : 0;
  const alerts = maturityAlerts(goals, todayISO());

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
        <div className="flex flex-col gap-6">
          {alerts.length > 0 && (
            <section
              role="alert"
              className="rounded-box flex flex-col gap-2 bg-amber-300 p-4 text-neutral-900"
            >
              <h2 className="flex items-center gap-2 font-extrabold">
                <BellRing className="h-5 w-5" aria-hidden />
                {alerts.length === 1 ? 'Aplicação vencendo' : 'Aplicações vencendo'}
              </h2>
              <ul className="flex flex-col gap-1 text-sm">
                {alerts.map(({ goal, deposit, daysLeft }) => (
                  <li key={deposit.id} className="flex flex-wrap justify-between gap-x-3">
                    <span>
                      <strong>{(goal.currency === 'USD' ? USD : BRL).format(deposit.amount)}</strong>{' '}
                      em {goal.name}
                    </span>
                    <span className="font-semibold">
                      {maturityLabel(daysLeft, deposit.maturityDate)}
                      {daysLeft >= 0 && ` (${formatDay(deposit.maturityDate)})`}
                    </span>
                  </li>
                ))}
              </ul>
              <p className="text-xs">
                Depois de resgatar ou reaplicar, atualize a aplicação em Editar na caixinha.
              </p>
            </section>
          )}
          <section className="grid grid-cols-2 gap-3 md:grid-cols-3">
            <div className="tile flex flex-col gap-1 bg-violet-500 p-4 text-white">
              <span className="eyebrow">Guardado em R$</span>
              <span className="metric text-2xl">{BRL.format(totalBrl)}</span>
            </div>
            <div className="tile flex flex-col gap-1 bg-emerald-400 p-4 text-neutral-900">
              <span className="eyebrow">Rende por mês*</span>
              <span className="metric text-2xl">{cdi ? BRL.format(monthlyYield) : '—'}</span>
            </div>
            {totalUsd > 0 && (
              <div className="tile flex flex-col gap-1 bg-sky-300 p-4 text-neutral-900">
                <span className="eyebrow">Em dólar</span>
                <span className="metric text-2xl">{USD.format(totalUsd)}</span>
              </div>
            )}
          </section>
          <p className="text-base-content/60 -mt-3 text-xs">
            * Estimativa bruta (sem IR) com o CDI de{' '}
            {cdi
              ? `${cdi.annualRate.toLocaleString('pt-BR')}% a.a. (Banco Central, ${cdi.date})`
              : '…'}
            , para as caixinhas em real com % do CDI preenchido (as em dólar usam a taxa fixa ao
            ano e ficam fora da tabela de IR).{' '}
            {cdi && cdi.selicOutlook.length > 0
              ? `Projeções seguem a Selic esperada pelo mercado (Focus de ${cdi.outlookDate?.split('-').reverse().join('/')}: ${cdi.selicOutlook
                  .slice(0, 3)
                  .map((o) => `${o.rate.toLocaleString('pt-BR')}% em ${o.year}`)
                  .join(', ')})`
              : 'Projeções consideram o CDI de hoje constante'}
            {' '}e descontam o IR regressivo de cada aporte.
          </p>

          {groups.map(([institution, items]) => (
            <section key={institution || 'sem'}>
              <h2 className="eyebrow mb-2 px-1">{institution || 'Sem instituição'}</h2>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {items.map((g) => (
                  <GoalCard
                    key={g.id}
                    goal={g}
                    cdi={cdi}
                    tone={GOAL_TONES[goals.indexOf(g) % GOAL_TONES.length]}
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
            </section>
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
  cdi,
  tone,
  onDeposit,
  onWithdraw,
  onEdit,
  onDelete,
}: {
  goal: SavingsGoal;
  cdi: Cdi | null;
  tone: Tone;
  onDeposit: (amount: number) => void;
  onWithdraw: (amount: number) => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const [amountInput, setAmountInput] = useState('');
  const pct = Math.min(
    100,
    Math.round((goal.currentAmount / Math.max(1, goal.targetAmount)) * 100),
  );
  const done = goal.currentAmount >= goal.targetAmount;
  const missing = Math.max(0, goal.targetAmount - goal.currentAmount);
  const money = goal.currency === 'USD' ? USD : BRL;
  const yieldPerMonth = cdi ? estimatedMonthlyYield(goal, cdi.annualRate) : null;
  const redemption = redemptionDate(goal);
  const daysLeft = redemption ? daysBetween(todayISO(), redemption) : null;
  const deposits = (goal.timeDeposits ?? []).map((deposit) => ({
    deposit,
    daysLeft: daysBetween(todayISO(), deposit.maturityDate),
  }));
  const free = goal.currentAmount - deposits.reduce((s, d) => s + d.deposit.amount, 0);
  const projection = useMemo(() => {
    if (done) return null;
    const today = todayISO();
    const rateAt = goalRateAt(goal, cdi, today);
    return rateAt === null ? null : projectGoal(goal, rateAt, today);
  }, [goal, cdi, done]);
  const atDeadline = projection?.atDeadline;
  const onTrack = atDeadline ? atDeadline.amount >= goal.targetAmount - 0.005 : null;

  function handleApply(direction: 'in' | 'out') {
    const v = parseMoneyInput(amountInput);
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
          <p className="metric text-3xl">{money.format(goal.currentAmount)}</p>
          <p className="text-xs font-semibold opacity-80">
            de {money.format(goal.targetAmount)}
            {!done && ` · faltam ${money.format(missing)}`}
          </p>
        </div>
        <div className="h-2.5 overflow-hidden rounded-full bg-black/15" aria-hidden>
          <div className="h-full rounded-full bg-current" style={{ width: `${pct}%` }} />
        </div>
      </div>

      <div className="flex flex-col gap-2 p-4">
        {Boolean(goal.cdiPercent || goal.annualRate || redemption || goal.lockDays) && (
          <div className="flex flex-wrap gap-2 text-sm">
            {goal.currency === 'BRL' && goal.cdiPercent != null && (
              <span className="badge badge-lg bg-base-200 gap-1 border-0 font-semibold">
                <TrendingUp className="h-4 w-4" aria-hidden />
                {goal.cdiPercent.toLocaleString('pt-BR')}% do CDI
                {yieldPerMonth != null && ` · ~${BRL.format(yieldPerMonth)}/mês`}
              </span>
            )}
            {goal.currency === 'USD' && goal.annualRate != null && (
              <span className="badge badge-lg bg-base-200 gap-1 border-0 font-semibold">
                <TrendingUp className="h-4 w-4" aria-hidden />
                {goal.annualRate.toLocaleString('pt-BR')}% a.a.
                {yieldPerMonth != null && ` · ~${USD.format(yieldPerMonth)}/mês`}
              </span>
            )}
            {redemption && daysLeft !== null && (
              <span
                className={`badge badge-lg gap-1 border-0 font-semibold ${
                  daysLeft <= 0 ? 'bg-emerald-300 text-neutral-900' : 'bg-base-200'
                }`}
              >
                <CalendarClock className="h-4 w-4" aria-hidden />
                {daysLeft <= 0
                  ? `Disponível desde ${formatDay(redemption)}`
                  : `Resgate ${formatDay(redemption)} · em ${daysLeft} dia${daysLeft === 1 ? '' : 's'}`}
              </span>
            )}
            {goal.lockDays && !goal.depositDate && (
              <span className="badge badge-lg bg-base-200 border-0">
                Prazo de {goal.lockDays} dias · informe a data do depósito
              </span>
            )}
          </div>
        )}
        {deposits.length > 0 && (
          <div className="rounded-box bg-base-200 flex flex-col gap-1.5 p-3 text-sm">
            <span className="flex items-center gap-1 font-semibold">
              <Lock className="h-4 w-4" aria-hidden />
              Aplicado com vencimento
            </span>
            <ul className="flex flex-col gap-1">
              {deposits.map(({ deposit, daysLeft }) => (
                <li key={deposit.id} className="flex items-center justify-between gap-2">
                  <span className="metric">{money.format(deposit.amount)}</span>
                  <span
                    className={`badge border-0 font-semibold ${
                      daysLeft <= 0
                        ? 'bg-emerald-300 text-neutral-900'
                        : daysLeft <= MATURITY_WARNING_DAYS
                          ? 'bg-amber-300 text-neutral-900'
                          : 'bg-base-100'
                    }`}
                  >
                    {daysLeft <= 0
                      ? maturityLabel(daysLeft, deposit.maturityDate)
                      : `${formatDay(deposit.maturityDate)} · ${maturityLabel(daysLeft, deposit.maturityDate).toLowerCase()}`}
                  </span>
                </li>
              ))}
            </ul>
            {free > 0.005 && (
              <span className="text-base-content/70 text-xs">
                {money.format(free)} livre, sem vencimento
              </span>
            )}
          </div>
        )}
        {projection && (atDeadline || projection.reachDate || goal.monthlyContribution) && (
          <div
            className={`rounded-box flex flex-col gap-1 p-3 text-sm ${
              onTrack === false ? 'bg-amber-100 text-neutral-900' : 'bg-base-200'
            }`}
          >
            {goal.monthlyContribution ? (
              <span className="flex items-center gap-1 font-semibold">
                <PiggyBank className="h-4 w-4" aria-hidden />
                Aporte de {money.format(goal.monthlyContribution)}/mês
              </span>
            ) : null}
            {atDeadline && (
              <span>
                No prazo: <strong>{money.format(atDeadline.amount)}</strong> líquido
                {atDeadline.yieldAmount > 0.005 &&
                  ` · ${money.format(atDeadline.yieldAmount)} de rendimento`}
                {atDeadline.taxAmount > 0.005 && ` (IR de ${money.format(atDeadline.taxAmount)} já descontado)`}
              </span>
            )}
            {atDeadline && !onTrack && (
              <span className="flex items-center gap-1 font-semibold">
                <Target className="h-4 w-4" aria-hidden />
                {atDeadline.requiredContribution === 0
                  ? 'Só o rendimento já leva à meta.'
                  : `Guarde ${money.format(atDeadline.requiredContribution)}/mês para chegar no prazo`}
              </span>
            )}
            {projection.reachDate ? (
              <span>
                {onTrack ? '✅ ' : ''}Meta batida em {formatMonth(projection.reachDate)} nesse ritmo
              </span>
            ) : (
              !atDeadline && <span>Defina um aporte mensal para ver quando chega na meta.</span>
            )}
          </div>
        )}
        <MoneyInput
          currency={goal.currency}
          placeholder="Valor"
          aria-label={`Valor para ${goal.name}`}
          value={amountInput}
          onChange={setAmountInput}
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

function formatDay(iso: string): string {
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

function formatMonth(iso: string): string {
  const [y, m] = iso.split('-');
  return `${m}/${y}`;
}
