'use client';

import { ArrowDownRight, ArrowUpRight, CreditCard, Landmark, PiggyBank } from 'lucide-react';
import Link from 'next/link';

import { DashboardCharts } from '@/components/DashboardCharts';
import { DebtsOverview } from '@/components/DebtsOverview';
import { CategoryAvatar } from '@/components/CategoryAvatar';
import { ExpandableTile, TileDetails } from '@/components/ExpandableTile';
import { SectionTitle } from '@/components/ui';
import {
  APP_TIME_ZONE,
  BRL,
  debtsOnDashboard,
  expensesByCategory,
  summarizeDebts,
  summarizeMonth,
} from '@/lib/finance';
import { USD } from '@/lib/savings';
import { useFinanceStore } from '@/lib/store';
import { useHydrated } from '@/lib/useHydratedStore';

const MONTH_NAME = new Intl.DateTimeFormat('pt-BR', { month: 'long', timeZone: APP_TIME_ZONE });
const HOUR = new Intl.DateTimeFormat('pt-BR', { hour: 'numeric', hourCycle: 'h23', timeZone: APP_TIME_ZONE });

function greeting(): string {
  const h = Number(HOUR.format(new Date()));
  if (h < 12) return 'Bom dia';
  if (h < 18) return 'Boa tarde';
  return 'Boa noite';
}

export default function DashboardPage() {
  const hydrated = useHydrated();
  const transactions = useFinanceStore((s) => s.transactions);
  const creditCards = useFinanceStore((s) => s.creditCards);
  const savingsGoals = useFinanceStore((s) => s.savingsGoals);
  const debts = useFinanceStore((s) => s.debts);
  const settings = useFinanceStore((s) => s.settings);

  const month = summarizeMonth(transactions);
  const categories = expensesByCategory(transactions);
  const totalLimit = creditCards.reduce((sum, c) => sum + c.limit, 0);
  const totalInvoice = creditCards.reduce((sum, c) => sum + c.currentInvoiceAmount, 0);
  const saved = savingsGoals
    .filter((g) => g.currency === 'BRL')
    .reduce((sum, g) => sum + g.currentAmount, 0);
  const savedUsd = savingsGoals
    .filter((g) => g.currency === 'USD')
    .reduce((sum, g) => sum + g.currentAmount, 0);
  const dashboardDebts = debtsOnDashboard(debts, settings);
  const debtSummary = summarizeDebts(dashboardDebts);
  const counts = {
    income: transactions.filter((t) => t.type === 'income').length,
    expense: transactions.filter((t) => t.type === 'expense').length,
    fixed: transactions.filter((t) => t.isFixed).length,
    unpaid: transactions.filter((t) => !t.isPaid).length,
  };
  const money = (n: number) => (hydrated ? BRL.format(n) : '—');
  // Pela data do lançamento, não pela ordem de cadastro (importações trazem datas antigas).
  const recent = [...transactions].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5);

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-4">
      <header className="pt-1 md:pt-0">
        <p className="eyebrow">{MONTH_NAME.format(new Date())} · visão geral</p>
        <h1 className="mt-1 text-3xl font-extrabold tracking-tight md:text-4xl">
          {hydrated ? greeting() : 'Olá'}! <span className="text-primary">💸</span>
        </h1>
      </header>

      {/* Saldo do mês: o bloco principal muda de cor com o sinal. */}
      <section
        className={`tile flex flex-col gap-4 p-5 sm:p-6 ${
          month.balance >= 0 ? 'bg-lime-300 text-neutral-900' : 'bg-red-500 text-white'
        }`}
      >
        <div className="eyebrow">Saldo do mês</div>
        <div className="metric text-5xl sm:text-6xl">{money(month.balance)}</div>
        <div className="flex flex-wrap gap-2">
          <span className="sticker bg-white">
            <ArrowUpRight className="h-3.5 w-3.5" aria-hidden /> Entradas {money(month.income)}
          </span>
          <span className="sticker bg-white">
            <ArrowDownRight className="h-3.5 w-3.5" aria-hidden /> Saídas {money(month.expense)}
          </span>
        </div>
      </section>

      <section className="grid grid-flow-row-dense grid-cols-2 items-start gap-3 lg:grid-cols-4">
        <ExpandableTile
          tone="cyan"
          icon={CreditCard}
          label="Limite livre"
          value={money(Math.max(0, totalLimit - totalInvoice))}
          hint={creditCards.length === 0 ? 'Nenhum cartão' : `Fatura ${money(totalInvoice)}`}
        >
          <TileDetails
            empty="Nenhum cartão cadastrado."
            rows={creditCards.map((c) => ({
              key: c.id,
              label: c.name,
              value: money(Math.max(0, c.limit - c.currentInvoiceAmount)),
              sub: `Fatura ${money(c.currentInvoiceAmount)} de ${money(c.limit)} · vence dia ${c.dueDay}`,
              progress: (c.currentInvoiceAmount / Math.max(1, c.limit)) * 100,
            }))}
          />
        </ExpandableTile>
        <ExpandableTile
          tone="violet"
          icon={PiggyBank}
          label="Guardado"
          value={money(saved)}
          hint={savedUsd > 0 ? `+ ${USD.format(savedUsd)} em dólar` : `${savingsGoals.length} caixinha(s)`}
        >
          <TileDetails
            empty="Nenhuma caixinha ainda."
            footer={{ href: '/caixinhas', label: 'Ver caixinhas' }}
            rows={savingsGoals.map((g) => {
              const fmt = g.currency === 'USD' ? USD : BRL;
              const pct = Math.round((g.currentAmount / Math.max(1, g.targetAmount)) * 100);
              return {
                key: g.id,
                label: g.name,
                value: hydrated ? fmt.format(g.currentAmount) : '—',
                sub: [g.institution, `${pct}% de ${hydrated ? fmt.format(g.targetAmount) : '—'}`]
                  .filter(Boolean)
                  .join(' · '),
                progress: pct,
              };
            })}
          />
        </ExpandableTile>
        <ExpandableTile
          tone={debtSummary.overdue > 0 ? 'red' : 'amber'}
          icon={Landmark}
          label="Dívidas"
          value={money(debtSummary.total)}
          hint={debtSummary.overdue > 0 ? `${money(debtSummary.overdue)} vencida` : 'Nada vencido'}
        >
          <TileDetails
            empty="Nenhuma dívida no painel."
            footer={{ href: '/dividas', label: 'Ver dívidas' }}
            rows={[...dashboardDebts]
              .sort((a, b) => b.currentAmount + b.overdueAmount - (a.currentAmount + a.overdueAmount))
              .map((d) => ({
                key: d.id,
                label: d.creditor,
                value: money(d.currentAmount + d.overdueAmount),
                sub: d.overdueAmount > 0 ? `${money(d.overdueAmount)} vencida` : d.description,
              }))}
          />
        </ExpandableTile>
        <ExpandableTile
          tone="graphite"
          label="Lançamentos"
          value={hydrated ? transactions.length : '—'}
          hint="no total"
        >
          <TileDetails
            empty="Nada lançado ainda."
            footer={{ href: '/transacoes', label: 'Ver transações' }}
            rows={
              transactions.length === 0
                ? []
                : [
                    { key: 'income', label: 'Entradas', value: counts.income },
                    { key: 'expense', label: 'Saídas', value: counts.expense },
                    { key: 'fixed', label: 'Fixos', value: counts.fixed },
                    { key: 'unpaid', label: 'A pagar', value: counts.unpaid },
                  ]
            }
          />
        </ExpandableTile>
      </section>

      {hydrated && categories.length > 0 && (
        <section className="panel p-4">
          <SectionTitle>Para onde foi o dinheiro</SectionTitle>
          <ul className="no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
            {categories.map((c) => (
              <li
                key={c.name}
                className="bg-base-200 flex min-w-36 shrink-0 items-center gap-2 rounded-field p-2"
              >
                <CategoryAvatar category={c.name} size="sm" />
                <div className="min-w-0">
                  <p className="truncate text-xs font-semibold opacity-70">{c.name}</p>
                  <p className="font-bold tabular-nums">{BRL.format(c.value)}</p>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      <DashboardCharts />

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="panel p-4">
          <SectionTitle
            action={
              <Link href="/transacoes" className="link link-hover text-sm font-semibold">
                Ver tudo
              </Link>
            }
          >
            Últimos lançamentos
          </SectionTitle>
          {!hydrated ? null : recent.length === 0 ? (
            <p className="text-base-content/60 py-6 text-center text-sm">
              Nada lançado ainda. Toque no <strong>+</strong> para começar.
            </p>
          ) : (
            <ul className="divide-base-content/5 divide-y">
              {recent.map((t) => (
                <li key={t.id} className="flex items-center gap-3 py-2.5">
                  <CategoryAvatar category={t.category} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">{t.description}</p>
                    <p className="text-base-content/60 text-xs">{t.category}</p>
                  </div>
                  <span
                    className={`shrink-0 font-bold tabular-nums ${
                      t.type === 'income' ? 'text-success' : ''
                    }`}
                  >
                    {t.type === 'income' ? '+' : '−'} {BRL.format(t.amount)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="panel p-4">
          <SectionTitle
            action={
              <Link href="/caixinhas" className="link link-hover text-sm font-semibold">
                Ver tudo
              </Link>
            }
          >
            Caixinhas
          </SectionTitle>
          {savingsGoals.length === 0 ? (
            <p className="text-base-content/60 py-6 text-center text-sm">
              Nenhuma meta ainda. Crie em <em>Caixinhas</em>.
            </p>
          ) : (
            <ul className="space-y-4">
              {savingsGoals.slice(0, 4).map((g) => {
                const pct = Math.min(100, Math.round((g.currentAmount / Math.max(1, g.targetAmount)) * 100));
                return (
                  <li key={g.id} className="space-y-1.5">
                    <div className="flex justify-between gap-2 text-sm">
                      <span className="truncate font-semibold">{g.name}</span>
                      <span className="shrink-0 font-bold tabular-nums">{pct}%</span>
                    </div>
                    <progress className="progress progress-primary h-3 w-full" value={pct} max={100} />
                    <p className="text-base-content/60 text-xs">
                      {(g.currency === 'USD' ? USD : BRL).format(g.currentAmount)} de{' '}
                      {(g.currency === 'USD' ? USD : BRL).format(g.targetAmount)}
                    </p>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </section>

      {hydrated && <DebtsOverview />}
    </div>
  );
}
