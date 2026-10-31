'use client';

import Link from 'next/link';
import { useEffect, useRef, useState, type FormEvent } from 'react';

import { MoneyInput } from '@/components/MoneyInput';
import {
  CATEGORIES,
  PAYMENT_METHOD_LABEL,
  TRANSACTION_TYPE_LABEL,
  todayISO,
} from '@/lib/finance';
import { parseMoneyInput, toMoneyInput } from '@/lib/money-mask';
import { useFinanceStore } from '@/lib/store';
import { useOpenedWith } from '@/lib/useMounted';
import { useCategories } from '@/lib/useCategories';
import type {
  PaymentMethod,
  Transaction,
  TransactionDraft,
  TransactionType,
} from '@/types/finance';

type Props = {
  open: boolean;
  onClose: () => void;
  initial?: Transaction;
  initialDraft?: TransactionDraft;
};

const PAYMENT_OPTIONS: PaymentMethod[] = ['pix', 'debit', 'credit_card', 'cash', 'bank_transfer'];

export function TransactionFormDialog({ open, onClose, initial, initialDraft }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const creditCards = useFinanceStore((s) => s.creditCards);
  const bankAccounts = useFinanceStore((s) => s.bankAccounts);
  const addTransaction = useFinanceStore((s) => s.addTransaction);
  const updateTransaction = useFinanceStore((s) => s.updateTransaction);
  const removeTransaction = useFinanceStore((s) => s.removeTransaction);
  const { names: categoryNames } = useCategories();

  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [type, setType] = useState<TransactionType>('expense');
  const [category, setCategory] = useState<string>(CATEGORIES[0]);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('pix');
  const [creditCardId, setCreditCardId] = useState<string>('');
  const [bankAccountId, setBankAccountId] = useState<string>('');
  const [date, setDate] = useState(todayISO());
  const [isFixed, setIsFixed] = useState(false);
  const [isPaid, setIsPaid] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // sync dialog open state with prop
  useEffect(() => {
    const dlg = dialogRef.current;
    if (!dlg) return;
    if (open && !dlg.open) dlg.showModal();
    if (!open && dlg.open) dlg.close();
  }, [open]);

  // prefill from `initial` (edit) or `initialDraft` (e.g. coming from IA)
  if (useOpenedWith(open, initial, initialDraft)) {
    const src = initial ?? initialDraft;
    if (src) {
      setDescription(src.description);
      setAmount(toMoneyInput(src.amount));
      setType(src.type);
      setCategory(src.category);
      setPaymentMethod(src.paymentMethod);
      setCreditCardId(src.creditCardId ?? '');
      setBankAccountId(src.bankAccountId ?? '');
      setDate(src.date);
      setIsFixed(src.isFixed);
      setIsPaid('isPaid' in src ? Boolean(src.isPaid) : true);
    } else {
      setDescription('');
      setAmount('');
      setType('expense');
      setCategory(CATEGORIES[0]);
      setPaymentMethod('pix');
      setCreditCardId('');
      setBankAccountId('');
      setDate(todayISO());
      setIsFixed(false);
      setIsPaid(true);
    }
    setError(null);
  }

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const parsedAmount = parseMoneyInput(amount);
    if (!description.trim()) return setError('Descrição obrigatória.');
    if (!parsedAmount || parsedAmount <= 0) return setError('Valor deve ser maior que zero.');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return setError('Data inválida.');
    if (paymentMethod === 'credit_card' && !creditCardId) {
      return setError('Selecione o cartão de crédito.');
    }

    const draft: TransactionDraft = {
      description: description.trim(),
      amount: parsedAmount,
      type,
      category,
      paymentMethod,
      creditCardId: paymentMethod === 'credit_card' ? creditCardId : null,
      bankAccountId: bankAccountId || null,
      date,
      isFixed,
      isPaid,
    };

    if (initial) {
      updateTransaction(initial.id, draft);
    } else {
      addTransaction(draft);
    }
    onClose();
  }

  return (
    <dialog
      ref={dialogRef}
      className="modal modal-bottom sm:modal-middle"
      onClose={onClose}
      onCancel={onClose}
    >
      <div className="modal-box max-w-xl">
        <h3 className="text-lg font-bold">
          {initial ? 'Editar lançamento' : 'Novo lançamento'}
        </h3>

        <form onSubmit={handleSubmit} className="mt-4 grid gap-3">
          <label className="form-control">
            <span className="label-text">Descrição</span>
            <input
              className="input input-bordered"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Ex: Jantar no iFood"
              required
              maxLength={120}
            />
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="form-control">
              <span className="label-text">Valor</span>
              <MoneyInput value={amount} onChange={setAmount} required />
            </label>

            <label className="form-control">
              <span className="label-text">Data</span>
              <input
                type="date"
                className="input input-bordered"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
              />
            </label>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <label className="form-control">
              <span className="label-text">Tipo</span>
              <select
                className="select select-bordered"
                value={type}
                onChange={(e) => setType(e.target.value as TransactionType)}
              >
                {(Object.keys(TRANSACTION_TYPE_LABEL) as TransactionType[]).map((t) => (
                  <option key={t} value={t}>
                    {TRANSACTION_TYPE_LABEL[t]}
                  </option>
                ))}
              </select>
            </label>

            <label className="form-control">
              <span className="label-text">Categoria</span>
              <select
                className="select select-bordered"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              >
                {/* Categoria fora da lista (veio da IA ou foi apagada) continua selecionável. */}
                {(categoryNames.includes(category) ? categoryNames : [category, ...categoryNames]).map(
                  (c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ),
                )}
              </select>
              <Link href="/configuracoes#categorias" className="link link-hover mt-1 text-xs" onClick={onClose}>
                + Criar categoria
              </Link>
            </label>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <label className="form-control">
              <span className="label-text">Forma de pagamento</span>
              <select
                className="select select-bordered"
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
              >
                {PAYMENT_OPTIONS.map((p) => (
                  <option key={p} value={p}>
                    {PAYMENT_METHOD_LABEL[p]}
                  </option>
                ))}
              </select>
            </label>

            <label className="form-control">
              <span className="label-text">Banco</span>
              <select
                className="select select-bordered"
                value={bankAccountId}
                onChange={(e) => setBankAccountId(e.target.value)}
              >
                <option value="">Sem banco</option>
                {bankAccounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {paymentMethod === 'credit_card' && (
            <label className="form-control">
              <span className="label-text">Cartão</span>
              {creditCards.length === 0 ? (
                <p className="text-warning text-sm">
                  Nenhum cartão cadastrado. Crie um em <em>Transações → aba Cartões</em>.
                </p>
              ) : (
                <select
                  className="select select-bordered"
                  value={creditCardId}
                  onChange={(e) => setCreditCardId(e.target.value)}
                  required
                >
                  <option value="">Selecione…</option>
                  {creditCards.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              )}
            </label>
          )}

          <div className="grid grid-cols-2 gap-3 pt-1">
            <label className="label cursor-pointer justify-start gap-3">
              <input
                type="checkbox"
                className="checkbox checkbox-primary"
                checked={isFixed}
                onChange={(e) => setIsFixed(e.target.checked)}
              />
              <span className="label-text">Recorrente (fixa)</span>
            </label>
            <label className="label cursor-pointer justify-start gap-3">
              <input
                type="checkbox"
                className="checkbox checkbox-primary"
                checked={isPaid}
                onChange={(e) => setIsPaid(e.target.checked)}
              />
              <span className="label-text">Já {type === 'income' ? 'recebido' : 'pago'}</span>
            </label>
          </div>

          {error && (
            <div role="alert" className="alert alert-error">
              <span>{error}</span>
            </div>
          )}

          <div className="modal-action mt-2">
            {/* No celular não há botão de excluir na lista: tocar no lançamento abre este formulário. */}
            {initial && (
              <button
                type="button"
                className="btn btn-ghost text-error mr-auto"
                onClick={() => {
                  if (!confirm('Excluir esse lançamento?')) return;
                  removeTransaction(initial.id);
                  onClose();
                }}
              >
                Excluir
              </button>
            )}
            <button type="button" className="btn btn-ghost" onClick={onClose}>
              Cancelar
            </button>
            <button type="submit" className="btn btn-primary">
              {initial ? 'Salvar' : 'Adicionar'}
            </button>
          </div>
        </form>
      </div>
      <form method="dialog" className="modal-backdrop">
        <button>fechar</button>
      </form>
    </dialog>
  );
}
