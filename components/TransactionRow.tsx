'use client';

import { Pencil, Trash2 } from 'lucide-react';

import { CategoryAvatar } from '@/components/CategoryAvatar';
import { BRL, PAYMENT_METHOD_LABEL } from '@/lib/finance';
import { useFinanceStore } from '@/lib/store';
import type { Transaction } from '@/types/finance';

/** Linha de lançamento: toque abre a edição, o selo alterna pago/em aberto. */
export function TransactionRow({
  tx,
  expected = false,
  onEdit,
  onTogglePaid,
  onDelete,
}: {
  tx: Transaction;
  /** Data futura: mostra "Previsto" no lugar do status de pagamento. */
  expected?: boolean;
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
        <span
          className={`font-bold tabular-nums ${income ? 'text-success' : ''} ${expected ? 'opacity-70' : ''}`}
        >
          {income ? '+' : '−'} {BRL.format(tx.amount)}
        </span>
        {expected ? (
          <span className="badge badge-sm badge-info badge-outline badge-dash font-semibold">Previsto</span>
        ) : (
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
        )}
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
