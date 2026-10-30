'use client';

import { CalendarClock, Pencil, Plus, ReceiptText, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';

import { CreditCardFormDialog } from '@/components/CreditCardFormDialog';
import { CreditCardInvoicesDialog } from '@/components/CreditCardInvoicesDialog';
import { MonthCard } from '@/components/MonthCard';
import { TransactionFormDialog } from '@/components/TransactionFormDialog';
import { EmptyState, PageHeader } from '@/components/ui';
import { BRL, cardLimit, monthKey, nextOpenInvoice, shortDate, todayISO } from '@/lib/finance';
import { useFinanceStore } from '@/lib/store';
import { groupByMonth, splitByTiming } from '@/lib/transaction-months';
import { useHydrated } from '@/lib/useHydratedStore';
import type { CreditCard } from '@/types/finance';

type View = 'months' | 'cards';

const VIEWS: { id: View; label: string }[] = [
  { id: 'months', label: 'Por mês' },
  { id: 'cards', label: 'Meus cartões' },
];

export default function TransacoesPage() {
  const hydrated = useHydrated();
  const transactions = useFinanceStore((s) => s.transactions);

  const [view, setView] = useState<View>('months');
  const [txDialogOpen, setTxDialogOpen] = useState(false);

  // Realizado (até hoje) e previsto (datas futuras) nunca se misturam no mesmo card.
  const { history, forecast, currentKey } = useMemo(() => {
    const today = todayISO();
    const { realized, expected } = splitByTiming(transactions, today);
    return {
      history: groupByMonth(realized, 'desc'),
      forecast: groupByMonth(expected, 'asc'),
      currentKey: monthKey(today),
    };
  }, [transactions]);

  return (
    <div className="mx-auto flex max-w-4xl flex-col">
      <PageHeader
        title="Transações"
        subtitle="Mês a mês: o que já aconteceu e o que está previsto."
        action={
          view === 'months' && (
            <button
              type="button"
              className="btn btn-primary hidden md:inline-flex"
              onClick={() => setTxDialogOpen(true)}
            >
              <Plus className="h-5 w-5" aria-hidden /> Novo lançamento
            </button>
          )
        }
      />

      <div role="tablist" className="no-scrollbar -mx-4 mb-4 flex gap-2 overflow-x-auto px-4 md:mx-0 md:px-0">
        {VIEWS.map((v) => (
          <button
            key={v.id}
            role="tab"
            type="button"
            aria-selected={view === v.id}
            className={`btn btn-sm shrink-0 rounded-full ${
              view === v.id ? 'btn-neutral' : 'btn-ghost bg-base-100'
            }`}
            onClick={() => setView(v.id)}
          >
            {v.label}
          </button>
        ))}
      </div>

      {view === 'cards' ? (
        <CreditCardsSection />
      ) : !hydrated ? (
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
                  <MonthCard key={m.key} totals={m} expected isCurrent={m.key === currentKey} />
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
                  <MonthCard key={m.key} totals={m} isCurrent={m.key === currentKey} />
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

const CARD_TONES = [
  'from-violet-500 to-fuchsia-500',
  'from-cyan-400 to-blue-600',
  'from-orange-400 to-pink-500',
  'from-emerald-400 to-lime-300',
];

function CreditCardsSection() {
  const creditCards = useFinanceStore((s) => s.creditCards);
  const savingsGoals = useFinanceStore((s) => s.savingsGoals);
  const invoices = useFinanceStore((s) => s.creditCardInvoices);
  const removeCreditCard = useFinanceStore((s) => s.removeCreditCard);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<CreditCard | undefined>(undefined);
  const [invoicesOf, setInvoicesOf] = useState<CreditCard | undefined>(undefined);

  return (
    <div className="grid gap-4">
      <button
        type="button"
        className="btn btn-primary self-start"
        onClick={() => {
          setEditing(undefined);
          setOpen(true);
        }}
      >
        <Plus className="h-5 w-5" aria-hidden /> Novo cartão
      </button>

      {creditCards.length === 0 ? (
        <EmptyState emoji="💳" title="Nenhum cartão cadastrado">
          Cadastre para acompanhar fatura e limite.
        </EmptyState>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {creditCards.map((c, i) => {
            const limit = cardLimit(c, savingsGoals);
            const limitGoal = savingsGoals.find(
              (g) => g.id === c.limitSavingsGoalId && g.currency === 'BRL',
            );
            const pct = Math.min(100, Math.round((c.currentInvoiceAmount / Math.max(1, limit)) * 100));
            const next = nextOpenInvoice(invoices, c.id);
            return (
              <article
                key={c.id}
                className={`tile flex flex-col gap-4 bg-gradient-to-br p-5 text-white ${CARD_TONES[i % CARD_TONES.length]}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="text-xl font-extrabold">{c.name}</h3>
                    <p className="text-xs font-semibold opacity-80">
                      {next
                        ? `Fecha ${shortDate(next.closingDate)} · vence ${shortDate(next.dueDate)}`
                        : `Fecha dia ${c.closingDay} · vence dia ${c.dueDay}`}
                    </p>
                  </div>
                  <div className="flex">
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm btn-square text-white"
                      aria-label={`Faturas de ${c.name}`}
                      onClick={() => setInvoicesOf(c)}
                    >
                      <ReceiptText className="h-4 w-4" aria-hidden />
                    </button>
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm btn-square text-white"
                      aria-label={`Editar ${c.name}`}
                      onClick={() => {
                        setEditing(c);
                        setOpen(true);
                      }}
                    >
                      <Pencil className="h-4 w-4" aria-hidden />
                    </button>
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm btn-square text-white"
                      aria-label={`Excluir ${c.name}`}
                      onClick={() => {
                        if (confirm(`Excluir cartão "${c.name}"?`)) removeCreditCard(c.id);
                      }}
                    >
                      <Trash2 className="h-4 w-4" aria-hidden />
                    </button>
                  </div>
                </div>
                <div>
                  <p className="eyebrow">Fatura atual</p>
                  <p className="metric text-4xl">{BRL.format(c.currentInvoiceAmount)}</p>
                </div>
                <div className="space-y-1">
                  <div className="h-2.5 overflow-hidden rounded-full bg-black/20">
                    <div className="h-full rounded-full bg-white" style={{ width: `${pct}%` }} />
                  </div>
                  <p className="text-xs font-semibold opacity-90">
                    {pct}% do limite de {BRL.format(limit)} · livre{' '}
                    {BRL.format(Math.max(0, limit - c.currentInvoiceAmount))}
                    {limitGoal && ` · garantido pela caixinha ${limitGoal.name}`}
                  </p>
                </div>
                <button
                  type="button"
                  className="btn min-h-11 border-0 bg-white/20 text-white hover:bg-white/30"
                  onClick={() => setInvoicesOf(c)}
                >
                  <ReceiptText className="h-4 w-4" aria-hidden />
                  {next ? `Fatura de ${BRL.format(next.amount)} em aberto` : 'Lançar fatura'}
                </button>
              </article>
            );
          })}
        </div>
      )}

      <CreditCardFormDialog open={open} onClose={() => setOpen(false)} initial={editing} />
      <CreditCardInvoicesDialog
        open={invoicesOf !== undefined}
        onClose={() => setInvoicesOf(undefined)}
        card={invoicesOf}
      />
    </div>
  );
}
