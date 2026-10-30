'use client';

import { Check, Pencil, Trash2, Undo2 } from 'lucide-react';
import { useEffect, useRef, useState, type FormEvent } from 'react';

import { BRL, invoiceStatus, shortDate, todayISO, type InvoiceStatus } from '@/lib/finance';
import { useFinanceStore } from '@/lib/store';
import { useOpenedWith } from '@/lib/useMounted';
import type { CreditCard, CreditCardInvoice } from '@/types/finance';

type Props = {
  open: boolean;
  onClose: () => void;
  card?: CreditCard;
};

const STATUS: Record<InvoiceStatus, { label: string; className: string }> = {
  paid: { label: 'Paga', className: 'badge-success' },
  open: { label: 'Em aberto', className: 'badge-warning' },
  overdue: { label: 'Vencida', className: 'badge-error' },
};

const MONTH = new Intl.DateTimeFormat('pt-BR', { month: 'short', year: '2-digit', timeZone: 'UTC' });
const monthLabel = (dateISO: string) => MONTH.format(new Date(`${dateISO}T00:00:00Z`)).replace('.', '');

export function CreditCardInvoicesDialog({ open, onClose, card }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const allInvoices = useFinanceStore((s) => s.creditCardInvoices);
  const addInvoice = useFinanceStore((s) => s.addCreditCardInvoice);
  const updateInvoice = useFinanceStore((s) => s.updateCreditCardInvoice);
  const removeInvoice = useFinanceStore((s) => s.removeCreditCardInvoice);
  const invoices = card
    ? allInvoices
        .filter((i) => i.creditCardId === card.id)
        .sort((a, b) => b.closingDate.localeCompare(a.closingDate))
    : [];

  const [editing, setEditing] = useState<CreditCardInvoice | undefined>(undefined);
  const [closingDate, setClosingDate] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [amount, setAmount] = useState('');
  const [paymentDate, setPaymentDate] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const dlg = dialogRef.current;
    if (!dlg) return;
    if (open && !dlg.open) dlg.showModal();
    if (!open && dlg.open) dlg.close();
  }, [open]);

  function fillForm(invoice: CreditCardInvoice | undefined) {
    setEditing(invoice);
    setClosingDate(invoice?.closingDate ?? '');
    setDueDate(invoice?.dueDate ?? '');
    // Fatura nova começa com o que está em aberto no cartão.
    setAmount(invoice ? String(invoice.amount) : card?.currentInvoiceAmount ? String(card.currentInvoiceAmount) : '');
    setPaymentDate(invoice?.paymentDate ?? '');
    setError(null);
  }

  if (useOpenedWith(open, card)) fillForm(undefined);

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!card) return;
    if (!closingDate || !dueDate) return setError('Informe fechamento e vencimento.');
    if (dueDate < closingDate) return setError('O vencimento não pode ser antes do fechamento.');
    const value = Number(amount.replace(',', '.'));
    if (!Number.isFinite(value) || value < 0) return setError('Valor inválido.');

    const data = { closingDate, dueDate, amount: value, paymentDate: paymentDate || null };
    if (editing) updateInvoice(editing.id, data);
    else addInvoice({ ...data, creditCardId: card.id });
    fillForm(undefined);
  }

  return (
    <dialog ref={dialogRef} className="modal modal-bottom sm:modal-middle" onClose={onClose} onCancel={onClose}>
      <div className="modal-box max-w-lg">
        <h3 className="text-lg font-bold">Faturas{card ? ` · ${card.name}` : ''}</h3>

        <form onSubmit={handleSubmit} className="bg-base-200 mt-4 grid gap-3 rounded-box p-3">
          <p className="text-sm font-bold">{editing ? 'Editar fatura' : 'Nova fatura'}</p>
          <div className="grid grid-cols-2 gap-3">
            <label className="form-control">
              <span className="label-text">Fechamento</span>
              <input
                type="date"
                className="input input-bordered"
                value={closingDate}
                onChange={(e) => setClosingDate(e.target.value)}
                required
              />
            </label>
            <label className="form-control">
              <span className="label-text">Vencimento</span>
              <input
                type="date"
                className="input input-bordered"
                value={dueDate}
                min={closingDate || undefined}
                onChange={(e) => setDueDate(e.target.value)}
                required
              />
            </label>
            <label className="form-control">
              <span className="label-text">Valor (R$)</span>
              <input
                className="input input-bordered"
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0,00"
                required
              />
            </label>
            <label className="form-control">
              <span className="label-text">Pago em</span>
              <input
                type="date"
                className="input input-bordered"
                value={paymentDate}
                onChange={(e) => setPaymentDate(e.target.value)}
              />
            </label>
          </div>
          <p className="text-base-content/60 text-xs">
            Deixe &quot;Pago em&quot; vazio enquanto a fatura estiver em aberto. Ao pagar, o valor sai da
            fatura atual e libera o limite.
          </p>

          {error && (
            <div role="alert" className="alert alert-error">
              <span>{error}</span>
            </div>
          )}

          <div className="flex justify-end gap-2">
            {editing && (
              <button type="button" className="btn btn-ghost" onClick={() => fillForm(undefined)}>
                Cancelar edição
              </button>
            )}
            <button type="submit" className="btn btn-primary">
              {editing ? 'Salvar' : 'Adicionar fatura'}
            </button>
          </div>
        </form>

        {invoices.length === 0 ? (
          <p className="text-base-content/60 py-6 text-center text-sm">Nenhuma fatura lançada ainda.</p>
        ) : (
          <ul className="divide-base-content/10 mt-2 divide-y">
            {invoices.map((inv) => {
              const status = STATUS[invoiceStatus(inv)];
              return (
                <li key={inv.id} className="flex flex-col gap-2 py-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold capitalize">{monthLabel(inv.dueDate)}</span>
                    <span className={`badge ${status.className}`}>{status.label}</span>
                    <span className="ml-auto font-extrabold tabular-nums">{BRL.format(inv.amount)}</span>
                  </div>
                  <p className="text-base-content/70 text-xs">
                    Fecha {shortDate(inv.closingDate)} · vence {shortDate(inv.dueDate)}
                    {inv.paymentDate && ` · paga em ${shortDate(inv.paymentDate)}`}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {inv.paymentDate ? (
                      <button
                        type="button"
                        className="btn btn-sm btn-ghost min-h-11"
                        onClick={() => updateInvoice(inv.id, { paymentDate: null })}
                      >
                        <Undo2 className="h-4 w-4" aria-hidden /> Desfazer pagamento
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="btn btn-sm btn-success min-h-11"
                        onClick={() => updateInvoice(inv.id, { paymentDate: todayISO() })}
                      >
                        <Check className="h-4 w-4" aria-hidden /> Paguei hoje
                      </button>
                    )}
                    <button
                      type="button"
                      className="btn btn-sm btn-ghost btn-square min-h-11 min-w-11"
                      aria-label={`Editar fatura de ${monthLabel(inv.dueDate)}`}
                      onClick={() => fillForm(inv)}
                    >
                      <Pencil className="h-4 w-4" aria-hidden />
                    </button>
                    <button
                      type="button"
                      className="btn btn-sm btn-ghost btn-square min-h-11 min-w-11"
                      aria-label={`Excluir fatura de ${monthLabel(inv.dueDate)}`}
                      onClick={() => {
                        if (confirm(`Excluir a fatura de ${monthLabel(inv.dueDate)}?`)) removeInvoice(inv.id);
                      }}
                    >
                      <Trash2 className="h-4 w-4" aria-hidden />
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        <div className="modal-action mt-2">
          <button type="button" className="btn" onClick={onClose}>
            Fechar
          </button>
        </div>
      </div>
      <form method="dialog" className="modal-backdrop">
        <button>fechar</button>
      </form>
    </dialog>
  );
}
