'use client';

import {
  ArrowDownRight,
  ArrowLeft,
  ArrowLeftRight,
  ArrowUpRight,
  CalendarClock,
  ChevronLeft,
  ChevronRight,
  Landmark,
  Plus,
} from 'lucide-react';
import Link from 'next/link';
import { useMemo, useState } from 'react';

import { BankFilter, useBankFilter } from '@/components/BankFilter';
import { matchesBank, withBank } from '@/lib/bank-filter';
import { CardNote, SubCard } from '@/components/MonthCard';
import { TransactionFormDialog } from '@/components/TransactionFormDialog';
import { TransactionRow } from '@/components/TransactionRow';
import { EmptyState } from '@/components/ui';
import { BRL, invoiceOutflows, isSameMonth, isTransfer, securedCardIds, todayISO } from '@/lib/finance';
import { useFinanceStore } from '@/lib/store';
import {
  isDebtPayment,
  monthTitle,
  shiftMonth,
  splitByTiming,
  totalsOf,
  type MonthTotals,
} from '@/lib/transaction-months';
import { useHydrated } from '@/lib/useHydratedStore';
import { useVisibleTransactions } from '@/lib/useVisibleTransactions';
import type { Transaction } from '@/types/finance';

type Filter = 'all' | 'income' | 'expense' | 'debt' | 'transfer' | 'fixed' | 'credit' | 'open';

const FILTERS: { id: Filter; label: string; match: (tx: Transaction) => boolean }[] = [
  { id: 'all', label: 'Todas', match: () => true },
  { id: 'income', label: 'Receitas', match: (tx) => tx.type === 'income' && !isTransfer(tx) },
  {
    id: 'expense',
    label: 'Despesas',
    match: (tx) => tx.type === 'expense' && !isTransfer(tx) && !isDebtPayment(tx),
  },
  { id: 'debt', label: 'Dívidas', match: isDebtPayment },
  { id: 'transfer', label: 'Movimentações', match: isTransfer },
  { id: 'fixed', label: 'Fixas', match: (tx) => tx.isFixed },
  { id: 'credit', label: 'No cartão', match: (tx) => tx.paymentMethod === 'credit_card' },
  { id: 'open', label: 'Em aberto', match: (tx) => !tx.isPaid },
];

const DATE_LABEL = new Intl.DateTimeFormat('pt-BR', {
  weekday: 'short',
  day: '2-digit',
  month: 'short',
  timeZone: 'UTC',
});

const formatDay = (iso: string) => DATE_LABEL.format(new Date(`${iso}T00:00:00Z`));

/** Agrupa por dia; `order` 'desc' como extrato de banco, 'asc' para o previsto (o próximo primeiro). */
function byDay(rows: ReadonlyArray<Transaction>, order: 'asc' | 'desc'): [string, Transaction[]][] {
  const groups = new Map<string, Transaction[]>();
  const sorted = [...rows].sort((a, b) =>
    order === 'desc' ? b.date.localeCompare(a.date) : a.date.localeCompare(b.date),
  );
  for (const t of sorted) groups.set(t.date, [...(groups.get(t.date) ?? []), t]);
  return [...groups.entries()];
}

/** Tela de um mês: totais realizados, previstos e a lista de lançamentos separada pelos dois. */
export function MonthDetail({ monthKey, initialBank = '' }: { monthKey: string; initialBank?: string }) {
  const hydrated = useHydrated();
  const transactions = useVisibleTransactions();
  const invoices = useFinanceStore((s) => s.creditCardInvoices);
  const creditCards = useFinanceStore((s) => s.creditCards);
  const removeTransaction = useFinanceStore((s) => s.removeTransaction);
  const toggleTransactionPaid = useFinanceStore((s) => s.toggleTransactionPaid);

  const [filter, setFilter] = useState<Filter>('all');
  const [bank, setBank] = useBankFilter(initialBank);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Transaction | undefined>(undefined);

  const secured = useMemo(() => securedCardIds(creditCards), [creditCards]);
  const { realized, expected, payments } = useMemo(() => {
    const today = todayISO();
    const inMonth = <T extends { date: string }>(rows: T[]) => rows.filter((r) => isSameMonth(r.date, monthKey));
    // Faturas não têm banco: com filtro de banco, os totais ficam só com os lançamentos dele.
    const outflows = bank ? { realized: [], expected: [] } : invoiceOutflows(invoices, today, secured);
    return {
      ...splitByTiming(
        inMonth(transactions).filter((t) => matchesBank(t, bank)),
        today,
      ),
      payments: { realized: inMonth(outflows.realized), expected: inMonth(outflows.expected) },
    };
  }, [transactions, invoices, monthKey, bank, secured]);
  const realizedTotals = totalsOf(monthKey, realized, payments.realized, secured);
  const expectedTotals = totalsOf(monthKey, expected, payments.expected, secured);
  const match = FILTERS.find((f) => f.id === filter)!.match;
  const realizedDays = byDay(realized.filter(match), 'desc');
  const expectedDays = byDay(expected.filter(match), 'asc');

  const rowHandlers = (t: Transaction) => ({
    onEdit: () => {
      setEditing(t);
      setDialogOpen(true);
    },
    onTogglePaid: () => toggleTransactionPaid(t.id),
    onDelete: () => {
      if (confirm('Excluir esse lançamento?')) removeTransaction(t.id);
    },
  });

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-5">
      <header className="flex flex-col gap-3">
        <Link href={withBank('/transacoes', bank)} className="btn btn-ghost btn-sm self-start px-2">
          <ArrowLeft className="h-4 w-4" aria-hidden /> Todos os meses
        </Link>
        <div className="flex items-center justify-between gap-2">
          <Link
            href={withBank(`/transacoes/${shiftMonth(monthKey, -1)}`, bank)}
            className="btn btn-ghost btn-square"
            aria-label="Mês anterior"
          >
            <ChevronLeft className="h-5 w-5" aria-hidden />
          </Link>
          <h1 className="text-center text-2xl font-extrabold tracking-tight md:text-3xl">{monthTitle(monthKey)}</h1>
          <Link
            href={withBank(`/transacoes/${shiftMonth(monthKey, 1)}`, bank)}
            className="btn btn-ghost btn-square"
            aria-label="Próximo mês"
          >
            <ChevronRight className="h-5 w-5" aria-hidden />
          </Link>
        </div>
      </header>

      {!hydrated ? (
        <p className="text-base-content/60 py-10 text-center text-sm">Carregando…</p>
      ) : (
        <>
          <BankFilter value={bank} onChange={setBank} />
          {(realized.length > 0 || payments.realized.length > 0) && (
            <TotalsPanel title="Realizado" totals={realizedTotals} />
          )}
          {(expected.length > 0 || payments.expected.length > 0) && (
            <TotalsPanel title="Previsto" totals={expectedTotals} expected />
          )}

          <div className="flex items-center gap-2">
            <div role="tablist" className="no-scrollbar -mx-4 flex flex-1 gap-2 overflow-x-auto px-4 md:mx-0 md:px-0">
              {FILTERS.map((f) => (
                <button
                  key={f.id}
                  role="tab"
                  type="button"
                  aria-selected={filter === f.id}
                  className={`btn btn-sm shrink-0 rounded-full ${
                    filter === f.id ? 'btn-neutral' : 'btn-ghost bg-base-100'
                  }`}
                  onClick={() => setFilter(f.id)}
                >
                  {f.label}
                </button>
              ))}
            </div>
            <button
              type="button"
              className="btn btn-primary btn-sm hidden shrink-0 md:inline-flex"
              onClick={() => {
                setEditing(undefined);
                setDialogOpen(true);
              }}
            >
              <Plus className="h-4 w-4" aria-hidden /> Novo
            </button>
          </div>

          {realizedDays.length === 0 && expectedDays.length === 0 ? (
            <EmptyState emoji="🧾" title="Nada por aqui">
              Nenhum lançamento {filter === 'all' ? 'neste mês' : 'nesse filtro'}.
            </EmptyState>
          ) : (
            <>
              {expectedDays.length > 0 && (
                <section aria-labelledby="month-expected" className="flex flex-col gap-3">
                  <div className="px-1">
                    <h2
                      id="month-expected"
                      className="eyebrow text-info flex items-center gap-1.5 !opacity-100"
                    >
                      <CalendarClock className="h-3.5 w-3.5" aria-hidden /> Previsto
                    </h2>
                    <p className="text-base-content/60 mt-1 text-xs">
                      Datas futuras: é o que deve acontecer, ainda não aconteceu.
                    </p>
                  </div>
                  {expectedDays.map(([day, rows]) => (
                    <div key={day}>
                      <h3 className="eyebrow mb-2 px-1">{formatDay(day)}</h3>
                      <ul className="border-info/40 divide-base-content/5 rounded-box divide-y overflow-hidden border-2 border-dashed">
                        {rows.map((t) => (
                          <TransactionRow key={t.id} tx={t} expected {...rowHandlers(t)} />
                        ))}
                      </ul>
                    </div>
                  ))}
                </section>
              )}

              {realizedDays.length > 0 && (
                <section aria-labelledby="month-realized" className="flex flex-col gap-3">
                  <h2 id="month-realized" className="eyebrow px-1">
                    Realizado
                  </h2>
                  {realizedDays.map(([day, rows]) => (
                    <div key={day}>
                      <h3 className="eyebrow mb-2 px-1">{formatDay(day)}</h3>
                      <ul className="panel divide-base-content/5 divide-y overflow-hidden">
                        {rows.map((t) => (
                          <TransactionRow key={t.id} tx={t} {...rowHandlers(t)} />
                        ))}
                      </ul>
                    </div>
                  ))}
                </section>
              )}
            </>
          )}
        </>
      )}

      <TransactionFormDialog open={dialogOpen} onClose={() => setDialogOpen(false)} initial={editing} />
    </div>
  );
}

function TotalsPanel({
  title,
  totals,
  expected = false,
}: {
  title: string;
  totals: MonthTotals;
  expected?: boolean;
}) {
  const positive = totals.balance >= 0;
  return (
    <section
      className={`flex flex-col gap-3 p-4 ${
        expected ? 'border-info/50 rounded-box border-2 border-dashed' : 'panel'
      }`}
    >
      <div className="flex items-end justify-between gap-3">
        <div>
          <h2 className={`eyebrow ${expected ? 'text-info !opacity-100' : ''}`}>{title}</h2>
          <p className="text-base-content/60 text-xs">
            {totals.count} {totals.count === 1 ? 'lançamento' : 'lançamentos'}
            {!expected && totals.openCount > 0 && ` · ${totals.openCount} em aberto`}
          </p>
        </div>
        <div className="text-right">
          <p className="eyebrow">{expected ? 'Saldo esperado' : 'Saldo'}</p>
          <p
            className={`metric text-2xl ${expected ? 'text-base-content/70' : positive ? 'text-success' : 'text-error'}`}
          >
            {BRL.format(totals.balance)}
          </p>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <SubCard tone="lime" icon={ArrowUpRight} label="Receitas" value={totals.income} muted={expected} />
        <SubCard tone="coral" icon={ArrowDownRight} label="Despesas" value={totals.expense} muted={expected} />
        <SubCard tone="violet" icon={Landmark} label="Dívidas" value={totals.debt} muted={expected} />
      </div>
      <CardNote totals={totals} expected={expected} />
      {totals.moved > 0 && (
        <p className="text-base-content/60 flex items-center gap-1.5 text-xs">
          <ArrowLeftRight className="h-3.5 w-3.5 shrink-0" aria-hidden />
          {BRL.format(totals.moved)} em movimentações entre contas e caixinhas, fora do saldo.
        </p>
      )}
    </section>
  );
}
