'use client';

import { Pencil, Plus, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';

import { CreditCardFormDialog } from '@/components/CreditCardFormDialog';
import { DebtsOverview } from '@/components/DebtsOverview';
import { TransactionFormDialog } from '@/components/TransactionFormDialog';
import { CategoryAvatar } from '@/components/CategoryAvatar';
import { EmptyState, PageHeader } from '@/components/ui';
import { BRL, PAYMENT_METHOD_LABEL, classifyTransaction } from '@/lib/finance';
import { useFinanceStore } from '@/lib/store';
import { useHydrated } from '@/lib/useHydratedStore';
import type { CreditCard, Transaction } from '@/types/finance';

type Tab = 'all' | 'fixed' | 'variable' | 'credit' | 'debt' | 'cards';

const TABS: { id: Tab; label: string }[] = [
  { id: 'all', label: 'Todas' },
  { id: 'fixed', label: 'Fixas' },
  { id: 'variable', label: 'Variáveis' },
  { id: 'credit', label: 'No cartão' },
  { id: 'debt', label: 'Dívidas' },
  { id: 'cards', label: 'Meus cartões' },
];

const DATE_LABEL = new Intl.DateTimeFormat('pt-BR', {
  weekday: 'short',
  day: '2-digit',
  month: 'short',
  timeZone: 'UTC',
});

const formatDay = (iso: string) => DATE_LABEL.format(new Date(`${iso}T00:00:00Z`));

export default function TransacoesPage() {
  const hydrated = useHydrated();
  const transactions = useFinanceStore((s) => s.transactions);
  const removeTransaction = useFinanceStore((s) => s.removeTransaction);
  const toggleTransactionPaid = useFinanceStore((s) => s.toggleTransactionPaid);

  const [tab, setTab] = useState<Tab>('all');
  const [txDialogOpen, setTxDialogOpen] = useState(false);
  const [editingTx, setEditingTx] = useState<Transaction | undefined>(undefined);

  const filtered = useMemo(() => {
    if (tab === 'all' || tab === 'cards') return transactions;
    return transactions.filter((t) => classifyTransaction(t) === tab);
  }, [transactions, tab]);

  // Agrupa por dia, do mais recente para o mais antigo, como um extrato de banco.
  const byDay = useMemo(() => {
    const groups = new Map<string, Transaction[]>();
    for (const t of [...filtered].sort((a, b) => b.date.localeCompare(a.date))) {
      groups.set(t.date, [...(groups.get(t.date) ?? []), t]);
    }
    return [...groups.entries()];
  }, [filtered]);

  return (
    <div className="mx-auto flex max-w-4xl flex-col">
      <PageHeader
        title="Transações"
        subtitle="Fixas, variáveis, cartões e dívidas."
        action={
          tab !== 'cards' && (
            <button
              type="button"
              className="btn btn-primary hidden md:inline-flex"
              onClick={() => {
                setEditingTx(undefined);
                setTxDialogOpen(true);
              }}
            >
              <Plus className="h-5 w-5" aria-hidden /> Novo lançamento
            </button>
          )
        }
      />

      <div role="tablist" className="no-scrollbar -mx-4 mb-4 flex gap-2 overflow-x-auto px-4 md:mx-0 md:px-0">
        {TABS.map((t) => (
          <button
            key={t.id}
            role="tab"
            type="button"
            aria-selected={tab === t.id}
            className={`btn btn-sm shrink-0 rounded-full ${
              tab === t.id ? 'btn-neutral' : 'btn-ghost bg-base-100'
            }`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'debt' && hydrated && (
        <div className="mb-4">
          <DebtsOverview />
        </div>
      )}

      {tab === 'cards' ? (
        <CreditCardsSection />
      ) : !hydrated ? (
        <p className="text-base-content/60 py-10 text-center text-sm">Carregando…</p>
      ) : byDay.length === 0 ? (
        <EmptyState emoji="🧾" title="Nenhum lançamento nessa visão">
          Toque no <strong>+</strong> para lançar um gasto ou receita.
        </EmptyState>
      ) : (
        <div className="flex flex-col gap-4">
          {byDay.map(([day, rows]) => (
            <section key={day}>
              <h2 className="eyebrow mb-2 px-1">{formatDay(day)}</h2>
              <ul className="panel divide-base-content/5 divide-y overflow-hidden">
                {rows.map((t) => (
                  <TransactionRow
                    key={t.id}
                    tx={t}
                    onEdit={() => {
                      setEditingTx(t);
                      setTxDialogOpen(true);
                    }}
                    onTogglePaid={() => toggleTransactionPaid(t.id)}
                    onDelete={() => {
                      if (confirm('Excluir esse lançamento?')) removeTransaction(t.id);
                    }}
                  />
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}

      <TransactionFormDialog
        open={txDialogOpen}
        onClose={() => setTxDialogOpen(false)}
        initial={editingTx}
      />
    </div>
  );
}

function TransactionRow({
  tx,
  onEdit,
  onTogglePaid,
  onDelete,
}: {
  tx: Transaction;
  onEdit: () => void;
  onTogglePaid: () => void;
  onDelete: () => void;
}) {
  const card = useFinanceStore((s) =>
    tx.creditCardId ? s.creditCards.find((c) => c.id === tx.creditCardId) : undefined,
  );
  const income = tx.type === 'income';

  return (
    <li className="flex items-center gap-3 p-3">
      <button type="button" onClick={onEdit} className="flex min-w-0 flex-1 items-center gap-3 text-left">
        <CategoryAvatar category={tx.category} />
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold">{tx.description}</p>
          <p className="text-base-content/60 truncate text-xs">
            {tx.category} · {card ? card.name : PAYMENT_METHOD_LABEL[tx.paymentMethod]}
            {tx.isFixed && ' · fixa'}
          </p>
        </div>
      </button>

      <div className="flex shrink-0 flex-col items-end gap-1">
        <span className={`font-bold tabular-nums ${income ? 'text-success' : ''}`}>
          {income ? '+' : '−'} {BRL.format(tx.amount)}
        </span>
        <button
          type="button"
          onClick={onTogglePaid}
          className={`badge badge-sm cursor-pointer font-semibold ${
            tx.isPaid ? 'badge-success badge-soft' : 'badge-warning'
          }`}
          title="Alternar status"
        >
          {tx.isPaid ? (income ? 'Recebido' : 'Pago') : 'Em aberto'}
        </button>
      </div>

      <div className="hidden shrink-0 md:flex">
        <button type="button" className="btn btn-ghost btn-sm btn-square" onClick={onEdit} aria-label="Editar">
          <Pencil className="h-4 w-4" aria-hidden />
        </button>
        <button
          type="button"
          className="btn btn-ghost btn-sm btn-square text-error"
          onClick={onDelete}
          aria-label="Excluir"
        >
          <Trash2 className="h-4 w-4" aria-hidden />
        </button>
      </div>
    </li>
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
  const removeCreditCard = useFinanceStore((s) => s.removeCreditCard);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<CreditCard | undefined>(undefined);

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
            const pct = Math.min(100, Math.round((c.currentInvoiceAmount / Math.max(1, c.limit)) * 100));
            return (
              <article
                key={c.id}
                className={`tile flex flex-col gap-4 bg-gradient-to-br p-5 text-white ${CARD_TONES[i % CARD_TONES.length]}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="text-xl font-extrabold">{c.name}</h3>
                    <p className="text-xs font-semibold opacity-80">
                      Fecha dia {c.closingDay} · vence dia {c.dueDay}
                    </p>
                  </div>
                  <div className="flex">
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
                    {pct}% do limite de {BRL.format(c.limit)} · livre{' '}
                    {BRL.format(Math.max(0, c.limit - c.currentInvoiceAmount))}
                  </p>
                </div>
              </article>
            );
          })}
        </div>
      )}

      <CreditCardFormDialog open={open} onClose={() => setOpen(false)} initial={editing} />
    </div>
  );
}
