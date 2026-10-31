'use client';

import { BellRing, CreditCard, Landmark, PiggyBank } from 'lucide-react';
import Link from 'next/link';

import { DashboardCharts } from '@/components/DashboardCharts';
import { DashboardSearch } from '@/components/DashboardSearch';
import { DebtsOverview } from '@/components/DebtsOverview';
import { CategoryAvatar } from '@/components/CategoryAvatar';
import { CategoryBreakdown } from '@/components/CategoryBreakdown';
import { ExpandableTile, TileDetails } from '@/components/ExpandableTile';
import { MonthBalanceTile } from '@/components/MonthBalanceTile';
import { SectionTitle } from '@/components/ui';
import {
  APP_TIME_ZONE,
  BRL,
  cardLimit,
  cardUsage,
  currentMonthKey,
  debtsOnDashboard,
  expensesByCategory,
  invoiceOutflows,
  nextOpenInvoice,
  shortDate,
  summarizeDebts,
  securedCardIds,
  securedCardSavings,
  summarizeMonth,
  todayISO,
} from '@/lib/finance';
import { withParams } from '@/lib/bank-filter';
import { greeting } from '@/lib/greeting';
import { maturityAlerts, maturityLabel, totalSavedBrl, USD } from '@/lib/savings';
import { useFinanceStore } from '@/lib/store';
import { useHydrated } from '@/lib/useHydratedStore';
import { useVisibleTransactions } from '@/lib/useVisibleTransactions';
import { useUsdRate } from '@/lib/useUsdRate';

const MONTH_NAME = new Intl.DateTimeFormat('pt-BR', { month: 'long', timeZone: APP_TIME_ZONE });

export default function DashboardPage() {
  const hydrated = useHydrated();
  // Limite do cartão é real: usa tudo. O resto (totais, gráfico, recentes) esconde as categorias ocultas.
  const allTransactions = useFinanceStore((s) => s.transactions);
  const transactions = useVisibleTransactions();
  const hiddenCount = useFinanceStore((s) => s.settings.hiddenCategories?.length ?? 0);
  const creditCards = useFinanceStore((s) => s.creditCards);
  const savingsGoals = useFinanceStore((s) => s.savingsGoals);
  const invoices = useFinanceStore((s) => s.creditCardInvoices);
  const debts = useFinanceStore((s) => s.debts);
  const settings = useFinanceStore((s) => s.settings);

  const secured = securedCardIds(creditCards);
  const month = summarizeMonth(transactions, undefined, invoiceOutflows(invoices, undefined, secured).realized, secured);
  const categories = expensesByCategory(transactions);
  const totalLimit = creditCards.reduce((sum, c) => sum + cardLimit(c, savingsGoals), 0);
  const usageOf = (cardId: string) => cardUsage(cardId, allTransactions, invoices).used;
  const totalInvoice = creditCards.reduce((sum, c) => sum + usageOf(c.id), 0);
  const usdRate = useUsdRate();
  const saved = totalSavedBrl(savingsGoals, usdRate?.rate ?? null);
  // Todas as caixinhas + o CDB que garante o limite do cartão (mesma soma da tela de Caixinhas).
  const securedSavings = securedCardSavings(creditCards, savingsGoals);
  const savedTotal = saved.total + securedSavings.total;
  const maturing = maturityAlerts(savingsGoals, todayISO());
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
          {hydrated ? greeting(settings.displayName) : 'Olá'}! <span className="text-primary">💸</span>
        </h1>
      </header>

      {hydrated && <DashboardSearch />}

      {hydrated && maturing.length > 0 && (
        <Link
          href="/caixinhas"
          role="alert"
          className="rounded-box flex min-h-11 items-center gap-3 bg-amber-300 p-4 text-neutral-900"
        >
          <BellRing className="h-5 w-5 shrink-0" aria-hidden />
          <span className="text-sm">
            <strong>
              {maturing.length === 1
                ? '1 aplicação vencendo'
                : `${maturing.length} aplicações vencendo`}
            </strong>
            {' · '}
            {(maturing[0].goal.currency === 'USD' ? USD : BRL).format(maturing[0].deposit.amount)} em{' '}
            {maturing[0].goal.name}:{' '}
            {maturityLabel(maturing[0].daysLeft, maturing[0].deposit.maturityDate).toLowerCase()}
          </span>
        </Link>
      )}

      {/* Saldo do mês: o bloco principal muda de cor com o sinal e abre o saldo de cada conta. */}
      <MonthBalanceTile
        balance={month.balance}
        income={month.income}
        expense={month.expense}
        money={money}
      />

      <section className="grid grid-flow-row-dense grid-cols-2 items-start gap-3 lg:grid-cols-4">
        <ExpandableTile
          tone="cyan"
          icon={CreditCard}
          label="Limite livre"
          value={money(Math.max(0, totalLimit - totalInvoice))}
          hint={creditCards.length === 0 ? 'Nenhum cartão' : `Usado ${money(totalInvoice)}`}
        >
          <TileDetails
            empty="Nenhum cartão cadastrado."
            rows={creditCards.map((c) => {
              const limit = cardLimit(c, savingsGoals);
              const used = usageOf(c.id);
              const next = nextOpenInvoice(invoices, c.id);
              const due = next ? shortDate(next.dueDate) : `dia ${c.dueDay}`;
              return {
                key: c.id,
                label: c.name,
                value: money(Math.max(0, limit - used)),
                sub: `Usado ${money(used)} de ${money(limit)} · vence ${due}`,
                progress: (used / Math.max(1, limit)) * 100,
              };
            })}
          />
        </ExpandableTile>
        <ExpandableTile
          tone="violet"
          icon={PiggyBank}
          label="Guardado"
          value={money(savedTotal)}
          hint={
            [
              `${savingsGoals.length + securedSavings.cards.length} caixinha(s)`,
              saved.usd > 0 &&
                (saved.usdInBrl !== null
                  ? `inclui ${USD.format(saved.usd)} (≈ ${money(saved.usdInBrl)})`
                  : `+ ${USD.format(saved.usd)} em dólar`),
            ]
              .filter(Boolean)
              .join(' · ')
          }
        >
          <TileDetails
            empty="Nenhuma caixinha ainda."
            footer={{ href: '/caixinhas', label: 'Ver caixinhas' }}
            rows={[
              ...securedSavings.cards.map(({ card, amount }) => ({
                key: `cartao-${card.id}`,
                label: card.name,
                value: hydrated ? BRL.format(amount) : '—',
                sub: 'CDB que garante o limite do cartão',
              })),
              ...savingsGoals.map((g) => {
              const fmt = g.currency === 'USD' ? USD : BRL;
              const pct = Math.round((g.currentAmount / Math.max(1, g.targetAmount)) * 100);
              return {
                key: g.id,
                label: g.name,
                value: hydrated ? fmt.format(g.currentAmount) : '—',
                sub: [
                  g.institution,
                  g.currency === 'USD' && usdRate && hydrated
                    ? `≈ ${BRL.format(g.currentAmount * usdRate.rate)}`
                    : null,
                  `${pct}% de ${hydrated ? fmt.format(g.targetAmount) : '—'}`,
                ]
                  .filter(Boolean)
                  .join(' · '),
                progress: pct,
              };
            }),
            ]}
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
          <SectionTitle
            action={
              <Link href="/configuracoes#categorias" className="link link-hover text-sm font-semibold">
                Ocultar categorias
              </Link>
            }
          >
            Para onde foi o dinheiro
          </SectionTitle>
          {hiddenCount > 0 && (
            <p className="text-base-content/60 -mt-1 mb-2 text-xs">
              {hiddenCount === 1 ? '1 categoria oculta' : `${hiddenCount} categorias ocultas`}: fora destes totais.
            </p>
          )}
          {/* Tocar numa categoria abre o mês já filtrado por ela. */}
          <CategoryBreakdown
            items={categories}
            hrefFor={(name) => withParams(`/transacoes/${currentMonthKey()}`, { categoria: name })}
          />
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
