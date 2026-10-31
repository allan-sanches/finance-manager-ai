'use client';

import { Check, FileUp, Pencil, Trash2, Undo2 } from 'lucide-react';
import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react';

import { InvoicePurchasesReview, type PurchaseRow } from '@/components/InvoicePurchasesReview';
import { MoneyInput } from '@/components/MoneyInput';
import { BRL, cardUsage, invoiceStatus, shortDate, todayISO, type InvoiceStatus } from '@/lib/finance';
import { findDuplicateCardEntries } from '@/lib/import/dedupe';
import { parseMoneyInput, toMoneyInput } from '@/lib/money-mask';
import { shrinkImage } from '@/lib/shrinkImage';
import { useFinanceStore } from '@/lib/store';
import { useOpenedWith } from '@/lib/useMounted';
import type { CreditCard, CreditCardInvoice, InvoicePreview, TransactionDraft } from '@/types/finance';

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

type ReadResponse = { ok: true; data: InvoicePreview } | { ok: false; error: string };

const MONTH = new Intl.DateTimeFormat('pt-BR', { month: 'short', year: '2-digit', timeZone: 'UTC' });
const monthLabel = (dateISO: string) => MONTH.format(new Date(`${dateISO}T00:00:00Z`)).replace('.', '');

const dayBefore = (dateISO: string) =>
  new Date(Date.parse(`${dateISO}T00:00:00Z`) - 86_400_000).toISOString().slice(0, 10);

export function CreditCardInvoicesDialog({ open, onClose, card }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const allInvoices = useFinanceStore((s) => s.creditCardInvoices);
  const transactions = useFinanceStore((s) => s.transactions);
  const addInvoice = useFinanceStore((s) => s.addCreditCardInvoice);
  const updateInvoice = useFinanceStore((s) => s.updateCreditCardInvoice);
  const removeInvoice = useFinanceStore((s) => s.removeCreditCardInvoice);
  const importTransactions = useFinanceStore((s) => s.importTransactions);
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
  const [reading, setReading] = useState(false);
  const [readNotes, setReadNotes] = useState<string[]>([]);
  const [fileKey, setFileKey] = useState(0);
  const [purchases, setPurchases] = useState<PurchaseRow[]>([]);

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
    // Fatura nova começa com as compras lançadas desde o último fechamento.
    const unbilled = card ? cardUsage(card.id, transactions, allInvoices).unbilled : 0;
    setAmount(toMoneyInput(invoice ? invoice.amount : unbilled));
    setPaymentDate(invoice?.paymentDate ?? '');
    setError(null);
    setReadNotes([]);
    setPurchases([]);
  }

  // Print(s) ou PDF da fatura → a IA lê fechamento, vencimento, total e os lançamentos.
  async function readInvoiceFile(event: ChangeEvent<HTMLInputElement>) {
    const picked = Array.from(event.target.files ?? []);
    setFileKey((k) => k + 1);
    if (picked.length === 0 || reading) return;
    setReading(true);
    setError(null);
    setReadNotes([]);
    setPurchases([]);
    try {
      const body = new FormData();
      body.set('kind', 'invoice');
      for (const f of await Promise.all(picked.map(shrinkImage))) body.append('file', f);
      const response = await fetch('/api/import', { method: 'POST', body });
      const payload = (await response.json().catch(() => ({
        ok: false,
        error: `Erro inesperado do servidor (${response.status}).`,
      }))) as ReadResponse;
      if (!payload.ok) return setError(payload.error);
      const { closingDate: closing, dueDate: due, amount: total, entries, warnings } = payload.data;
      if (closing) setClosingDate(closing);
      if (due) setDueDate(due);
      if (total != null) setAmount(toMoneyInput(total));
      const duplicates = card ? findDuplicateCardEntries(entries, transactions, card.id) : new Set<number>();
      setPurchases(entries.map((e, i) => ({ ...e, selected: !duplicates.has(i), duplicate: duplicates.has(i) })));
      setReadNotes(['Dados lidos pela IA: confira antes de salvar.', ...warnings]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha de rede.');
    } finally {
      setReading(false);
    }
  }

  if (useOpenedWith(open, card)) fillForm(undefined);

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!card) return;
    if (!closingDate || !dueDate) return setError('Informe fechamento e vencimento.');
    if (dueDate < closingDate) return setError('O vencimento não pode ser antes do fechamento.');
    const value = parseMoneyInput(amount) ?? 0;

    const data = { closingDate, dueDate, amount: value, paymentDate: paymentDate || null };
    if (editing) updateInvoice(editing.id, data);
    else addInvoice({ ...data, creditCardId: card.id });

    // Tudo que veio na fatura é dela: data no fechamento ou depois (ex.: parcela) volta para a véspera,
    // senão contaria de novo como compra da fatura seguinte no limite.
    const lastDay = dayBefore(closingDate);
    const drafts: TransactionDraft[] = purchases
      .filter((p) => p.selected)
      .map((p) => ({
        description: p.description.trim(),
        amount: p.amount,
        type: p.type,
        category: p.category,
        paymentMethod: 'credit_card',
        creditCardId: card.id,
        date: p.date > lastDay ? lastDay : p.date,
        isFixed: false,
        isPaid: Boolean(paymentDate),
      }));
    importTransactions(drafts);
    fillForm(undefined);
  }

  return (
    <dialog ref={dialogRef} className="modal modal-bottom sm:modal-middle" onClose={onClose} onCancel={onClose}>
      <div className="modal-box max-w-lg">
        <h3 className="text-lg font-bold">Faturas{card ? ` · ${card.name}` : ''}</h3>

        <form onSubmit={handleSubmit} className="bg-base-200 mt-4 grid gap-3 rounded-box p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-bold">{editing ? 'Editar fatura' : 'Nova fatura'}</p>
            <label className={`btn btn-sm btn-outline min-h-11 ${reading ? 'btn-disabled' : ''}`}>
              {reading ? (
                <span className="loading loading-spinner loading-sm" aria-hidden />
              ) : (
                <FileUp className="h-4 w-4" aria-hidden />
              )}
              {reading ? 'Lendo fatura…' : 'Ler print ou PDF'}
              <input
                key={fileKey}
                type="file"
                className="hidden"
                accept="image/*,.pdf"
                multiple
                disabled={reading}
                onChange={readInvoiceFile}
              />
            </label>
          </div>
          {readNotes.length > 0 && (
            <ul className="text-info flex flex-col gap-0.5 text-xs font-semibold">
              {readNotes.map((n) => (
                <li key={n}>{n}</li>
              ))}
            </ul>
          )}
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
              <span className="label-text">Valor</span>
              <MoneyInput value={amount} onChange={setAmount} required />
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
            Fatura em aberto ocupa o limite do cartão. Ao preencher &quot;Pago em&quot;, o valor libera o
            limite e sai do saldo da conta naquele mês. Compras com data antes do fechamento já contam
            dentro desta fatura.
          </p>

          {purchases.length > 0 && (
            <InvoicePurchasesReview
              rows={purchases}
              onChange={setPurchases}
              invoiceAmount={parseMoneyInput(amount)}
            />
          )}

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
              {purchases.some((p) => p.selected) && ` + ${purchases.filter((p) => p.selected).length} compra(s)`}
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
