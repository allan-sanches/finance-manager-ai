import { ArrowDownRight, ArrowUpRight, ChevronRight, CreditCard, Landmark, type LucideIcon } from 'lucide-react';
import Link from 'next/link';

import { BRL } from '@/lib/finance';
import { TONE_CLASS, type Tone } from '@/lib/tones';
import { monthTitle, type MonthTotals } from '@/lib/transaction-months';

/**
 * Card de um mês na tela de transações, com receitas, despesas e dívidas em subcards.
 * `expected` desenha o card tracejado e sem cor: são valores previstos, não aconteceram ainda.
 */
export function MonthCard({
  totals,
  expected = false,
  isCurrent = false,
  bank = '',
}: {
  totals: MonthTotals;
  expected?: boolean;
  isCurrent?: boolean;
  /** Filtro de banco ativo: segue para a tela do mês. */
  bank?: string;
}) {
  const positive = totals.balance >= 0;
  const title = expected && isCurrent ? `Resto de ${monthTitle(totals.key).toLowerCase()}` : monthTitle(totals.key);

  return (
    <Link
      href={bank ? `/transacoes/${totals.key}?banco=${encodeURIComponent(bank)}` : `/transacoes/${totals.key}`}
      className={`group flex flex-col gap-3 p-4 transition-transform active:scale-[0.99] ${
        expected ? 'border-info/50 bg-base-100/40 rounded-box border-2 border-dashed' : 'panel'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-lg font-extrabold">{title}</h3>
            {isCurrent && !expected && <span className="badge badge-sm badge-primary font-semibold">Mês atual</span>}
            {expected && (
              <span className="badge badge-sm badge-info badge-outline badge-dash font-semibold">Previsto</span>
            )}
          </div>
          <p className="text-base-content/60 text-xs">
            {totals.count} {totals.count === 1 ? 'lançamento' : 'lançamentos'}
            {!expected && totals.openCount > 0 && ` · ${totals.openCount} em aberto`}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1 text-right">
          <div>
            <p className="eyebrow">{expected ? 'Saldo esperado' : 'Saldo'}</p>
            <p
              className={`metric text-xl ${expected ? 'text-base-content/70' : positive ? 'text-success' : 'text-error'}`}
            >
              {BRL.format(totals.balance)}
            </p>
          </div>
          <ChevronRight
            className="text-base-content/40 h-5 w-5 transition-transform group-hover:translate-x-0.5"
            aria-hidden
          />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <SubCard tone="lime" icon={ArrowUpRight} label="Receitas" value={totals.income} muted={expected} />
        <SubCard tone="coral" icon={ArrowDownRight} label="Despesas" value={totals.expense} muted={expected} />
        <SubCard tone="violet" icon={Landmark} label="Dívidas" value={totals.debt} muted={expected} />
      </div>
      <CardNote totals={totals} expected={expected} />
    </Link>
  );
}

/** Subcard de um total. Apagado (`muted`) no previsto para não competir com o realizado. */
export function SubCard({
  tone,
  icon: Icon,
  label,
  value,
  muted = false,
}: {
  tone: Tone;
  icon: LucideIcon;
  label: string;
  value: number;
  muted?: boolean;
}) {
  return (
    <div
      className={`flex min-w-0 flex-col gap-1 rounded-xl p-2.5 ${
        muted ? 'bg-base-200 text-base-content' : TONE_CLASS[tone]
      }`}
    >
      <span className="eyebrow flex items-center gap-1 truncate !text-[10px] !tracking-wider">
        <Icon className="h-3 w-3 shrink-0" aria-hidden />
        {label}
      </span>
      <span className="metric truncate text-sm sm:text-base">{BRL.format(value)}</span>
    </div>
  );
}

/**
 * Compras no crédito não entram no saldo (só a fatura, quando é paga): esta linha mostra as duas
 * coisas para o total não parecer que "sumiu".
 */
export function CardNote({ totals, expected = false }: { totals: MonthTotals; expected?: boolean }) {
  if (totals.card <= 0 && totals.invoices <= 0) return null;
  const parts: string[] = [];
  if (totals.invoices > 0) {
    parts.push(`${expected ? 'Fatura a pagar' : 'Fatura paga'} ${BRL.format(totals.invoices)} (entra no saldo)`);
  }
  if (totals.card > 0) {
    parts.push(`${BRL.format(totals.card)} em compras no cartão (saem do saldo quando a fatura for paga)`);
  }
  return (
    <p className="text-base-content/70 flex items-start gap-1.5 text-xs">
      <CreditCard className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
      <span>{parts.join(' · ')}</span>
    </p>
  );
}
