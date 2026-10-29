'use client';

import { useState, type FormEvent } from 'react';

import { TransactionFormDialog } from '@/components/TransactionFormDialog';
import { useFinanceStore } from '@/lib/store';
import type { ChatExtraction } from '@/types/finance';

type ApiResponse =
  | { ok: true; data: ChatExtraction }
  | { ok: false; error: string };

const PAYMENT_LABEL: Record<string, string> = {
  cash: 'Dinheiro',
  debit: 'Débito',
  credit_card: 'Cartão de crédito',
  pix: 'Pix',
  bank_transfer: 'Transferência',
};

const CONFIDENCE_LABEL: Record<string, string> = {
  low: 'Baixa',
  medium: 'Média',
  high: 'Alta',
};

export function IaInputForm() {
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ChatExtraction | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const addTransaction = useFinanceStore((s) => s.addTransaction);
  const creditCards = useFinanceStore((s) => s.creditCards);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!message.trim() || loading) return;
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          message,
          creditCards: creditCards.map(({ id, name }) => ({ id, name })),
        }),
      });
      const payload = (await response.json().catch(() => ({
        ok: false,
        error: `Erro inesperado do servidor (${response.status}).`,
      }))) as ApiResponse;
      if (!payload.ok) {
        setError(payload.error);
      } else {
        setResult(payload.data);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha de rede.');
    } finally {
      setLoading(false);
    }
  }

  function handleConfirm() {
    if (!result) return;
    addTransaction(result.transaction);
    setResult(null);
    setMessage('');
  }

  return (
    <div className="flex flex-col gap-4">
      <form onSubmit={handleSubmit} className="panel">
        <div className="card-body gap-3">
          <label htmlFor="ia-message" className="label">
            <span className="label-text font-medium">Descreva a transação</span>
          </label>
          <textarea
            id="ia-message"
            className="textarea textarea-bordered min-h-24 w-full"
            placeholder='Ex: "Gastei 45 reais no iFood ontem à noite no crédito"'
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            maxLength={1000}
            disabled={loading}
          />
          <div className="card-actions items-center justify-between">
            <span className="text-base-content/50 text-xs">
              {message.length}/1000 — as chaves da IA ficam somente no servidor.
            </span>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={loading || !message.trim()}
            >
              {loading ? (
                <>
                  <span className="loading loading-spinner loading-sm" />
                  Processando…
                </>
              ) : (
                'Extrair com IA'
              )}
            </button>
          </div>
        </div>
      </form>

      {error && (
        <div role="alert" className="alert alert-error">
          <span>{error}</span>
        </div>
      )}

      {result && (
        <>
          <ExtractionPreview
            extraction={result}
            creditCardName={creditCards.find((c) => c.id === result.transaction.creditCardId)?.name}
            onEdit={() => setEditorOpen(true)}
            onConfirm={handleConfirm}
          />
          <TransactionFormDialog
            open={editorOpen}
            onClose={() => {
              setEditorOpen(false);
              setResult(null);
              setMessage('');
            }}
            initialDraft={result.transaction}
          />
        </>
      )}
    </div>
  );
}

function ExtractionPreview({
  extraction,
  creditCardName,
  onEdit,
  onConfirm,
}: {
  extraction: ChatExtraction;
  creditCardName?: string;
  onEdit: () => void;
  onConfirm: () => void;
}) {
  const { transaction, confidence, notes } = extraction;
  const amount = new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(transaction.amount);
  return (
    <div className="panel">
      <div className="card-body">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="card-title">Pré-visualização</h2>
          <span
            className={`badge ${
              confidence === 'high'
                ? 'badge-success'
                : confidence === 'medium'
                  ? 'badge-warning'
                  : 'badge-error'
            }`}
          >
            Confiança: {CONFIDENCE_LABEL[confidence]}
          </span>
        </div>

        <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Descrição" value={transaction.description} />
          <Field
            label="Valor"
            value={amount}
            valueClassName={transaction.type === 'expense' ? 'text-error' : 'text-success'}
          />
          <Field label="Tipo" value={transaction.type === 'expense' ? 'Despesa' : 'Receita'} />
          <Field label="Categoria" value={transaction.category} />
          <Field
            label="Forma de pagamento"
            value={PAYMENT_LABEL[transaction.paymentMethod] ?? transaction.paymentMethod}
          />
          {transaction.paymentMethod === 'credit_card' && (
            <Field label="Cartão" value={creditCardName ?? 'Não identificado'} />
          )}
          <Field label="Data" value={transaction.date} />
          <Field label="Recorrente (fixa)" value={transaction.isFixed ? 'Sim' : 'Não'} />
          <Field label="Já pago" value={transaction.isPaid ? 'Sim' : 'Não'} />
        </dl>

        {notes && (
          <p className="text-base-content/70 text-sm">
            <strong>Observações da IA:</strong> {notes}
          </p>
        )}

        <div className="card-actions justify-end">
          <button type="button" className="btn btn-ghost" onClick={onEdit}>
            Editar antes de salvar
          </button>
          <button type="button" className="btn btn-primary" onClick={onConfirm}>
            Confirmar lançamento
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  valueClassName,
}: {
  label: string;
  value: string;
  valueClassName?: string;
}) {
  return (
    <div className="flex flex-col">
      <dt className="text-base-content/60 text-xs uppercase tracking-wide">{label}</dt>
      <dd className={`font-medium ${valueClassName ?? ''}`}>{value}</dd>
    </div>
  );
}
