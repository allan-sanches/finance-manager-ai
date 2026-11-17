'use client';

import { Pencil, Plus, ReceiptText, Trash2 } from 'lucide-react';
import { useState } from 'react';

import { CreditCardFormDialog } from '@/components/CreditCardFormDialog';
import { CreditCardInvoicesDialog } from '@/components/CreditCardInvoicesDialog';
import { EmptyState, PageHeader } from '@/components/ui';
import { BRL, cardLimit, cardUsage, nextOpenInvoice, shortDate } from '@/lib/finance';
import { useFinanceStore } from '@/lib/store';
import type { CreditCard } from '@/types/finance';

const CARD_TONES = [
  'from-violet-500 to-fuchsia-500',
  'from-cyan-400 to-blue-600',
  'from-orange-400 to-pink-500',
  'from-emerald-400 to-lime-300',
];

export default function CartoesPage() {
  const creditCards = useFinanceStore((s) => s.creditCards);
  const transactions = useFinanceStore((s) => s.transactions);
  const savingsGoals = useFinanceStore((s) => s.savingsGoals);
  const invoices = useFinanceStore((s) => s.creditCardInvoices);
  const removeCreditCard = useFinanceStore((s) => s.removeCreditCard);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<CreditCard | undefined>(undefined);
  const [invoicesOf, setInvoicesOf] = useState<CreditCard | undefined>(undefined);

  return (
    <div className="mx-auto flex max-w-4xl flex-col">
      <PageHeader
        title="Cartões"
        subtitle="Limite, faturas e vencimentos de cada cartão."
        action={
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => {
              setEditing(undefined);
              setOpen(true);
            }}
          >
            <Plus className="h-5 w-5" aria-hidden /> Novo cartão
          </button>
        }
      />

      {creditCards.length === 0 ? (
        <EmptyState emoji="💳" title="Nenhum cartão cadastrado">
          Cadastre para acompanhar fatura e limite.
        </EmptyState>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {creditCards.map((c, i) => {
            const limit = cardLimit(c, savingsGoals, transactions);
            const limitGoal = savingsGoals.find(
              (g) => g.id === c.limitSavingsGoalId && g.currency === 'BRL',
            );
            const usage = cardUsage(c.id, transactions, invoices);
            const pct = Math.min(100, Math.round((usage.used / Math.max(1, limit)) * 100));
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
                  <p className="eyebrow">Limite usado</p>
                  <p className="metric text-4xl">{BRL.format(usage.used)}</p>
                  <p className="text-xs font-semibold opacity-90">
                    {usage.openInvoices > 0 && `${BRL.format(usage.openInvoices)} em fatura aberta · `}
                    {BRL.format(usage.unbilled)} em compras
                    {usage.lastClosingDate ? ` desde ${shortDate(usage.lastClosingDate)}` : ''}
                  </p>
                </div>
                <div className="space-y-1">
                  <div className="h-2.5 overflow-hidden rounded-full bg-black/20">
                    <div className="h-full rounded-full bg-white" style={{ width: `${pct}%` }} />
                  </div>
                  <p className="text-xs font-semibold opacity-90">
                    {pct}% do limite de {BRL.format(limit)} · livre{' '}
                    {BRL.format(Math.max(0, limit - usage.used))}
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
