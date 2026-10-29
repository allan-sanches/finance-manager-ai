'use client';

import { useMemo, useState } from 'react';

import { CreditCardFormDialog } from '@/components/CreditCardFormDialog';
import { DebtsOverview } from '@/components/DebtsOverview';
import { TransactionFormDialog } from '@/components/TransactionFormDialog';
import { BRL, PAYMENT_METHOD_LABEL, classifyTransaction } from '@/lib/finance';
import { useFinanceStore } from '@/lib/store';
import { useHydrated } from '@/lib/useHydratedStore';
import type { CreditCard, Transaction } from '@/types/finance';

type Tab = 'all' | 'fixed' | 'variable' | 'credit' | 'debt' | 'cards';

const TABS: { id: Tab; label: string }[] = [
  { id: 'all', label: 'Todas' },
  { id: 'fixed', label: 'Fixas' },
  { id: 'variable', label: 'Variáveis' },
  { id: 'credit', label: 'Cartões' },
  { id: 'debt', label: 'Dívidas' },
  { id: 'cards', label: 'Gerenciar cartões' },
];

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

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold md:text-3xl">Transações</h1>
          <p className="text-base-content/60 text-sm">
            Lançamentos divididos entre fixos, variáveis, cartões, empréstimos e dívidas.
          </p>
        </div>
        {tab !== 'cards' && (
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => {
              setEditingTx(undefined);
              setTxDialogOpen(true);
            }}
          >
            + Novo lançamento
          </button>
        )}
      </header>

      <div role="tablist" className="tabs tabs-border overflow-x-auto">
        {TABS.map((t) => (
          <button
            key={t.id}
            role="tab"
            type="button"
            className={`tab ${tab === t.id ? 'tab-active' : ''}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'debt' && hydrated && <DebtsOverview />}

      {tab === 'cards' ? (
        <CreditCardsSection />
      ) : (
        <TransactionsTable
          rows={filtered}
          hydrated={hydrated}
          onEdit={(t) => {
            setEditingTx(t);
            setTxDialogOpen(true);
          }}
          onTogglePaid={(id) => toggleTransactionPaid(id)}
          onDelete={(id) => {
            if (confirm('Excluir esse lançamento?')) removeTransaction(id);
          }}
        />
      )}

      <TransactionFormDialog
        open={txDialogOpen}
        onClose={() => setTxDialogOpen(false)}
        initial={editingTx}
      />
    </div>
  );
}

function TransactionsTable({
  rows,
  hydrated,
  onEdit,
  onTogglePaid,
  onDelete,
}: {
  rows: ReadonlyArray<Transaction>;
  hydrated: boolean;
  onEdit: (t: Transaction) => void;
  onTogglePaid: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const creditCards = useFinanceStore((s) => s.creditCards);
  const cardById = useMemo(() => {
    const m = new Map<string, CreditCard>();
    for (const c of creditCards) m.set(c.id, c);
    return m;
  }, [creditCards]);

  return (
    <div className="card bg-base-200 shadow">
      <div className="card-body p-0">
        <div className="overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th>Data</th>
                <th>Descrição</th>
                <th>Categoria</th>
                <th>Pagamento</th>
                <th className="text-right">Valor</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {!hydrated ? (
                <tr>
                  <td colSpan={7} className="py-10 text-center text-sm">
                    Carregando…
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    className="text-base-content/60 py-12 text-center text-sm"
                  >
                    Nenhum lançamento nessa visão. Clique em <em>Novo lançamento</em>.
                  </td>
                </tr>
              ) : (
                rows.map((t) => (
                  <tr key={t.id}>
                    <td className="whitespace-nowrap">{t.date}</td>
                    <td>
                      <div className="font-medium">{t.description}</div>
                      {t.creditCardId && (
                        <div className="text-base-content/60 text-xs">
                          {cardById.get(t.creditCardId)?.name ?? 'Cartão removido'}
                        </div>
                      )}
                    </td>
                    <td>
                      <span className="badge badge-ghost">{t.category}</span>
                      {t.isFixed && (
                        <span className="badge badge-outline badge-sm ml-1">fixa</span>
                      )}
                    </td>
                    <td>{PAYMENT_METHOD_LABEL[t.paymentMethod]}</td>
                    <td
                      className={`text-right font-semibold ${
                        t.type === 'income' ? 'text-success' : 'text-error'
                      }`}
                    >
                      {t.type === 'income' ? '+ ' : '− '}
                      {BRL.format(t.amount)}
                    </td>
                    <td>
                      <button
                        type="button"
                        className={`badge ${
                          t.isPaid ? 'badge-success' : 'badge-warning'
                        } cursor-pointer`}
                        onClick={() => onTogglePaid(t.id)}
                        title="Alternar status"
                      >
                        {t.isPaid
                          ? t.type === 'income'
                            ? 'Recebido'
                            : 'Pago'
                          : 'Em aberto'}
                      </button>
                    </td>
                    <td className="text-right">
                      <div className="join">
                        <button
                          type="button"
                          className="btn btn-ghost btn-xs join-item"
                          onClick={() => onEdit(t)}
                        >
                          Editar
                        </button>
                        <button
                          type="button"
                          className="btn btn-ghost btn-xs join-item text-error"
                          onClick={() => onDelete(t.id)}
                        >
                          Excluir
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function CreditCardsSection() {
  const creditCards = useFinanceStore((s) => s.creditCards);
  const removeCreditCard = useFinanceStore((s) => s.removeCreditCard);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<CreditCard | undefined>(undefined);

  return (
    <div className="grid gap-4">
      <div className="flex justify-end">
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => {
            setEditing(undefined);
            setOpen(true);
          }}
        >
          + Novo cartão
        </button>
      </div>

      {creditCards.length === 0 ? (
        <div className="card bg-base-200 shadow">
          <div className="card-body items-center text-center">
            <p className="text-base-content/60">Nenhum cartão cadastrado.</p>
          </div>
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {creditCards.map((c) => {
            const pct = Math.min(100, Math.round((c.currentInvoiceAmount / c.limit) * 100));
            return (
              <article key={c.id} className="card bg-base-200 shadow">
                <div className="card-body">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="card-title">{c.name}</h3>
                      <p className="text-base-content/60 text-xs">
                        Fecha dia {c.closingDay} · vence dia {c.dueDay}
                      </p>
                    </div>
                    <div className="join">
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm join-item"
                        onClick={() => {
                          setEditing(c);
                          setOpen(true);
                        }}
                      >
                        Editar
                      </button>
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm join-item text-error"
                        onClick={() => {
                          if (confirm(`Excluir cartão "${c.name}"?`)) removeCreditCard(c.id);
                        }}
                      >
                        Excluir
                      </button>
                    </div>
                  </div>

                  <p className="text-base-content/70 mt-1 text-sm">
                    Fatura atual: <strong>{BRL.format(c.currentInvoiceAmount)}</strong> de{' '}
                    {BRL.format(c.limit)}
                  </p>
                  <progress
                    className="progress progress-warning w-full"
                    value={pct}
                    max={100}
                  />
                  <p className="text-base-content/60 text-xs">
                    {pct}% usado · disponível {BRL.format(Math.max(0, c.limit - c.currentInvoiceAmount))}
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
