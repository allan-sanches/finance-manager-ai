'use client';

import { CalendarClock, Plus } from 'lucide-react';
import { use, useMemo, useState } from 'react';

import { BankFilter, bankParam, matchesBank, useBankFilter } from '@/components/BankFilter';
import { MonthCard } from '@/components/MonthCard';
import { TransactionFormDialog } from '@/components/TransactionFormDialog';
import { EmptyState, PageHeader } from '@/components/ui';
import { invoiceOutflows, monthKey, todayISO } from '@/lib/finance';
import { useFinanceStore } from '@/lib/store';
import { groupByMonth, splitByTiming } from '@/lib/transaction-months';
import { useHydrated } from '@/lib/useHydratedStore';

export default function TransacoesPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const hydrated = useHydrated();
  const transactions = useFinanceStore((s) => s.transactions);
  const invoices = useFinanceStore((s) => s.creditCardInvoices);

  const [txDialogOpen, setTxDialogOpen] = useState(false);
  const [bankFilter, setBankFilter] = useBankFilter(bankParam(use(searchParams).banco));

  // Realizado (até hoje) e previsto (datas futuras) nunca se misturam no mesmo card.
  const { history, forecast, currentKey } = useMemo(() => {
    const today = todayISO();
    const filtered = transactions.filter((t) => matchesBank(t, bankFilter));
    const { realized, expected } = splitByTiming(filtered, today);
    // Faturas não têm banco: com filtro ligado, ficam de fora para os totais serem só do banco.
    const payments = bankFilter ? { realized: [], expected: [] } : invoiceOutflows(invoices, today);
    return {
      history: groupByMonth(realized, 'desc', payments.realized),
      forecast: groupByMonth(expected, 'asc', payments.expected),
      currentKey: monthKey(today),
    };
  }, [transactions, invoices, bankFilter]);

  return (
    <div className="mx-auto flex max-w-4xl flex-col">
      <PageHeader
        title="Transações"
        subtitle="Mês a mês: o que já aconteceu e o que está previsto."
        action={
          <button
            type="button"
            className="btn btn-primary hidden md:inline-flex"
            onClick={() => setTxDialogOpen(true)}
          >
            <Plus className="h-5 w-5" aria-hidden /> Novo lançamento
          </button>
        }
      />

      {hydrated && <BankFilter value={bankFilter} onChange={setBankFilter} className="-mt-2 mb-4" />}

      {!hydrated ? (
        <p className="text-base-content/60 py-10 text-center text-sm">Carregando…</p>
      ) : history.length === 0 && forecast.length === 0 ? (
        <EmptyState emoji="🧾" title="Nenhum lançamento ainda">
          Toque no <strong>+</strong> para lançar um gasto ou receita.
        </EmptyState>
      ) : (
        <div className="flex flex-col gap-6">
          {forecast.length > 0 && (
            <section aria-labelledby="forecast-title" className="flex flex-col gap-3">
              <div className="px-1">
                <h2 id="forecast-title" className="eyebrow text-info flex items-center gap-1.5 !opacity-100">
                  <CalendarClock className="h-3.5 w-3.5" aria-hidden /> Previsto
                </h2>
                <p className="text-base-content/60 mt-1 text-xs">
                  Lançamentos com data futura. São expectativas: ainda não entraram nem saíram da sua conta.
                </p>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                {forecast.map((m) => (
                  <MonthCard key={m.key} totals={m} expected isCurrent={m.key === currentKey} bank={bankFilter} />
                ))}
              </div>
            </section>
          )}

          {history.length > 0 && (
            <section aria-labelledby="history-title" className="flex flex-col gap-3">
              <h2 id="history-title" className="eyebrow px-1">
                Realizado
              </h2>
              <div className="grid gap-3 md:grid-cols-2">
                {history.map((m) => (
                  <MonthCard key={m.key} totals={m} isCurrent={m.key === currentKey} bank={bankFilter} />
                ))}
              </div>
            </section>
          )}
        </div>
      )}

      <TransactionFormDialog open={txDialogOpen} onClose={() => setTxDialogOpen(false)} />
    </div>
  );
}
