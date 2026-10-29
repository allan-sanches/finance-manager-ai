'use client';

import { DashboardCharts } from '@/components/DashboardCharts';
import { DebtsOverview } from '@/components/DebtsOverview';
import { BRL, summarizeMonth } from '@/lib/finance';
import { useFinanceStore } from '@/lib/store';
import { useHydrated } from '@/lib/useHydratedStore';

export default function DashboardPage() {
  const hydrated = useHydrated();
  const transactions = useFinanceStore((s) => s.transactions);
  const creditCards = useFinanceStore((s) => s.creditCards);
  const savingsGoals = useFinanceStore((s) => s.savingsGoals);

  const month = summarizeMonth(transactions);
  const totalLimit = creditCards.reduce((sum, c) => sum + c.limit, 0);
  const totalInvoice = creditCards.reduce((sum, c) => sum + c.currentInvoiceAmount, 0);
  const availableLimit = Math.max(0, totalLimit - totalInvoice);

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold md:text-3xl">Dashboard</h1>
        <p className="text-base-content/60 text-sm">
          Visão geral do mês — saldo, fluxo de caixa, cartões e metas.
        </p>
      </header>

      <section className="stats stats-vertical lg:stats-horizontal bg-base-200 w-full shadow">
        <div className="stat">
          <div className="stat-title">Saldo do mês</div>
          <div className={`stat-value ${month.balance >= 0 ? 'text-success' : 'text-error'}`}>
            {hydrated ? BRL.format(month.balance) : '—'}
          </div>
          <div className="stat-desc">Entradas − saídas</div>
        </div>
        <div className="stat">
          <div className="stat-title">Entradas</div>
          <div className="stat-value">{hydrated ? BRL.format(month.income) : '—'}</div>
          <div className="stat-desc">Recebidos no mês</div>
        </div>
        <div className="stat">
          <div className="stat-title">Saídas</div>
          <div className="stat-value text-error">
            {hydrated ? BRL.format(month.expense) : '—'}
          </div>
          <div className="stat-desc">Gastos no mês</div>
        </div>
        <div className="stat">
          <div className="stat-title">Limite disponível</div>
          <div className="stat-value">{hydrated ? BRL.format(availableLimit) : '—'}</div>
          <div className="stat-desc">
            {creditCards.length === 0
              ? 'Nenhum cartão'
              : `${creditCards.length} cartão(s) · fatura atual ${BRL.format(totalInvoice)}`}
          </div>
        </div>
      </section>

      <DashboardCharts />

      {hydrated && <DebtsOverview compact />}

      <section className="grid gap-4 md:grid-cols-2">
        <div className="card bg-base-200 shadow">
          <div className="card-body">
            <h2 className="card-title">Caixinhas</h2>
            {savingsGoals.length === 0 ? (
              <p className="text-base-content/60 text-sm">
                Nenhuma meta cadastrada. Crie sua primeira caixinha em <em>Caixinhas</em>.
              </p>
            ) : (
              <ul className="space-y-3">
                {savingsGoals.slice(0, 3).map((g) => {
                  const pct = Math.min(
                    100,
                    Math.round((g.currentAmount / Math.max(1, g.targetAmount)) * 100),
                  );
                  return (
                    <li key={g.id} className="space-y-1">
                      <div className="flex justify-between text-sm">
                        <span className="font-medium">{g.name}</span>
                        <span className="text-base-content/60">
                          {BRL.format(g.currentAmount)} / {BRL.format(g.targetAmount)}
                        </span>
                      </div>
                      <progress
                        className="progress progress-primary w-full"
                        value={pct}
                        max={100}
                      />
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
        <div className="card bg-base-200 shadow">
          <div className="card-body">
            <h2 className="card-title">Cartões</h2>
            {creditCards.length === 0 ? (
              <p className="text-base-content/60 text-sm">
                Nenhum cartão cadastrado. Cadastre em <em>Transações → Cartões</em>.
              </p>
            ) : (
              <ul className="space-y-2 text-sm">
                {creditCards.map((c) => {
                  const used = Math.min(100, Math.round((c.currentInvoiceAmount / c.limit) * 100));
                  return (
                    <li key={c.id} className="space-y-1">
                      <div className="flex justify-between">
                        <span className="font-medium">{c.name}</span>
                        <span className="text-base-content/60">
                          {BRL.format(c.currentInvoiceAmount)} / {BRL.format(c.limit)}
                        </span>
                      </div>
                      <progress
                        className="progress progress-warning w-full"
                        value={used}
                        max={100}
                      />
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
