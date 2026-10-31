'use client';

import { ArrowDownRight, ArrowUpRight, ChevronDown, Plus } from 'lucide-react';
import { useId, useState } from 'react';

import { BankAccountFormDialog } from '@/components/BankAccountFormDialog';
import { accountBalance, shortDate } from '@/lib/finance';
import { useFinanceStore } from '@/lib/store';
import { normalizeCategoryName } from '@/lib/tones';
import type { BankAccount } from '@/types/finance';

// Atalhos para cadastrar com um toque; somem quando a conta já existe.
const SUGGESTED_ACCOUNTS = ['Inter', 'Mercado Pago'];

type Dialog = { initial?: BankAccount; presetName?: string } | null;

/** Saldo do mês no topo do dashboard; ao toque abre o saldo de cada conta. */
export function MonthBalanceTile({
  balance,
  income,
  expense,
  fromSavings = 0,
  money,
}: {
  balance: number;
  income: number;
  expense: number;
  /** Resgates menos aplicações de caixinhas/investimentos no mês (ver savingsDrawdown). */
  fromSavings?: number;
  money: (n: number) => string;
}) {
  const accounts = useFinanceStore((s) => s.bankAccounts);
  const transactions = useFinanceStore((s) => s.transactions);
  const [open, setOpen] = useState(false);
  const [dialog, setDialog] = useState<Dialog>(null);
  const detailsId = useId();

  // Saldo informado + o que entrou/saiu da conta depois dessa data (lançamentos com a tag do banco).
  const current = new Map(accounts.map((a) => [a.id, accountBalance(a, transactions)]));
  const totalInAccounts = accounts.reduce((sum, a) => sum + (current.get(a.id)?.balance ?? a.balance), 0);
  const existing = new Set(accounts.map((a) => normalizeCategoryName(a.name)));
  const suggestions = SUGGESTED_ACCOUNTS.filter((n) => !existing.has(normalizeCategoryName(n)));

  return (
    <section
      className={`tile flex flex-col p-5 sm:p-6 ${
        balance >= 0 ? 'bg-lime-300 text-neutral-900' : 'bg-red-500 text-white'
      }`}
    >
      <button
        type="button"
        aria-expanded={open}
        aria-controls={detailsId}
        onClick={() => setOpen((o) => !o)}
        className="flex w-full cursor-pointer flex-col gap-4 text-left"
      >
        <span className="eyebrow flex w-full items-center gap-1.5">
          <span className="flex-1">Resultado do mês</span>
          <span className="normal-case tracking-normal">
            {accounts.length > 0 ? `Em contas ${money(totalInAccounts)}` : 'Ver contas'}
          </span>
          <ChevronDown
            className={`h-4 w-4 shrink-0 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
            aria-hidden
          />
        </span>
        <span className="metric text-5xl sm:text-6xl">{money(balance)}</span>
        <span className="-mt-2 text-sm font-semibold opacity-85">
          {fromSavings > 0.005
            ? `${money(fromSavings)} tirados de caixinhas e investimentos para cobrir o mês`
            : fromSavings < -0.005
              ? `${money(-fromSavings)} guardados em caixinhas e investimentos`
              : 'O que entrou menos o que saiu no mês'}
        </span>
        <span className="flex flex-wrap gap-2">
          <span className="sticker bg-white text-neutral-900">
            <ArrowUpRight className="h-3.5 w-3.5" aria-hidden /> Entradas {money(income)}
          </span>
          <span className="sticker bg-white text-neutral-900">
            <ArrowDownRight className="h-3.5 w-3.5" aria-hidden /> Saídas {money(expense)}
          </span>
        </span>
      </button>

      <div
        id={detailsId}
        inert={!open}
        className={`grid transition-[grid-template-rows] duration-300 ease-out ${
          open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
        }`}
      >
        <div className="overflow-hidden">
          <div className="mt-4 flex flex-col gap-3 border-t border-current/20 pt-4">
            {accounts.length === 0 ? (
              <p className="text-sm font-medium opacity-80">
                Cadastre suas contas para ver o saldo de cada uma aqui.
              </p>
            ) : (
              <ul className="grid gap-2 sm:grid-cols-2">
                {accounts.map((a) => (
                  <li key={a.id}>
                    <button
                      type="button"
                      onClick={() => setDialog({ initial: a })}
                      aria-label={`Atualizar saldo de ${a.name}`}
                      className="flex min-h-14 w-full items-center justify-between gap-3 rounded-field bg-black/10 px-3 py-2 text-left hover:bg-black/15"
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-bold">{a.name}</span>
                        <span className="block text-xs font-medium opacity-75">
                          Atualizado {shortDate(a.balanceDate)}
                          {(current.get(a.id)?.after ?? 0) > 0 &&
                            ` + ${current.get(a.id)!.after} lançamento${current.get(a.id)!.after === 1 ? '' : 's'} depois`}
                        </span>
                      </span>
                      <span className="shrink-0 text-lg font-extrabold tabular-nums">
                        {money(current.get(a.id)?.balance ?? a.balance)}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}

            {accounts.length > 1 && (
              <div className="flex items-baseline justify-between gap-3 px-1">
                <span className="text-sm font-bold">Total em contas</span>
                <span className="text-lg font-extrabold tabular-nums">{money(totalInAccounts)}</span>
              </div>
            )}

            <div className="flex flex-wrap gap-2">
              {suggestions.map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setDialog({ presetName: n })}
                  className="flex min-h-11 items-center gap-1.5 rounded-field bg-black/10 px-3 text-sm font-bold hover:bg-black/15"
                >
                  <Plus className="h-4 w-4" aria-hidden /> {n}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setDialog({})}
                className="flex min-h-11 items-center gap-1.5 rounded-field bg-black/10 px-3 text-sm font-bold hover:bg-black/15"
              >
                <Plus className="h-4 w-4" aria-hidden /> {suggestions.length > 0 ? 'Outra conta' : 'Adicionar conta'}
              </button>
            </div>
          </div>
        </div>
      </div>

      <BankAccountFormDialog
        open={dialog !== null}
        onClose={() => setDialog(null)}
        initial={dialog?.initial}
        presetName={dialog?.presetName}
      />
    </section>
  );
}
