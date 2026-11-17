import { isCardGuaranteeMove } from '@/lib/finance';
import { dayBefore } from '@/lib/installments';
import type { CreditCard, SavingsGoal, Transaction } from '@/types/finance';

// Rendimento como o banco calcula: o saldo rende por dia útil a uma fração do CDI (CDI anual em
// base 252). O app guarda o valor conferido e a data; ao carregar, o servidor leva o saldo até
// ontem. Feriados não entram na conta (diferença de centavos), só fins de semana.

/** Fator de um dia útil: CDI anual (ex.: 14,9) a `cdiPercent` % (ex.: 100). */
export const dailyCdiFactor = (cdiAnnualPercent: number, cdiPercent: number): number =>
  1 + (Math.pow(1 + cdiAnnualPercent / 100, 1 / 252) - 1) * (cdiPercent / 100);

const nextDay = (dateISO: string) =>
  new Date(Date.parse(`${dateISO}T00:00:00Z`) + 86_400_000).toISOString().slice(0, 10);

// Feriados nacionais de data fixa (não há rendimento). Carnaval, Sexta-feira Santa e Corpus Christi
// mudam de data e ficam de fora: diferença de centavos.
const FIXED_HOLIDAYS = new Set(['01-01', '04-21', '05-01', '09-07', '10-12', '11-02', '11-15', '11-20', '12-25']);

const isBusinessDay = (dateISO: string) => {
  const weekday = new Date(`${dateISO}T00:00:00Z`).getUTCDay();
  return weekday !== 0 && weekday !== 6 && !FIXED_HOLIDAYS.has(dateISO.slice(5));
};

/**
 * Saldo conferido em `fromDate` levado até `toDate`: em cada dia útil rende sobre o saldo do dia
 * anterior; `moves` (por data) são aplicações (+) e resgates (−) do dia.
 */
export function accrue(
  amount: number,
  fromDate: string,
  toDate: string,
  factor: number,
  moves: ReadonlyMap<string, number> = new Map(),
): number {
  let value = amount;
  for (let d = nextDay(fromDate); d <= toDate; d = nextDay(d)) {
    if (isBusinessDay(d)) value *= factor;
    value += moves.get(d) ?? 0;
  }
  return Math.round(value * 100) / 100;
}

type Accruable = {
  creditCards: CreditCard[];
  savingsGoals: SavingsGoal[];
  transactions: ReadonlyArray<Pick<Transaction, 'creditCardId' | 'isTransfer' | 'paymentMethod' | 'date' | 'type' | 'amount'>>;
};

/**
 * Leva até ontem o CDB que garante cada cartão (com as aplicações e resgates ligados a ele) e as
 * caixinhas em reais que rendem % do CDI. Devolve o valor rendido com a data de ontem: o que vier
 * a partir de hoje o app soma por cima (securedCardLimit).
 */
export function accrueSnapshot<S extends Accruable>(snapshot: S, cdiAnnualPercent: number | null, today: string): S {
  if (!cdiAnnualPercent) return snapshot;
  const upTo = dayBefore(today);

  const creditCards = snapshot.creditCards.map((card) => {
    if (!card.securedLimit || !card.cdiPercent || !card.limitDate || card.limitDate >= upTo) return card;
    const moves = new Map<string, number>();
    for (const tx of snapshot.transactions) {
      if (tx.creditCardId !== card.id || !isCardGuaranteeMove(tx) || tx.date <= card.limitDate || tx.date > upTo) continue;
      moves.set(tx.date, (moves.get(tx.date) ?? 0) + (tx.type === 'expense' ? tx.amount : -tx.amount));
    }
    const limit = accrue(card.limit, card.limitDate, upTo, dailyCdiFactor(cdiAnnualPercent, card.cdiPercent), moves);
    return { ...card, limit, limitDate: upTo };
  });

  const savingsGoals = snapshot.savingsGoals.map((goal) => {
    if (goal.currency !== 'BRL' || !goal.cdiPercent || !goal.amountDate || goal.amountDate >= upTo) return goal;
    const currentAmount = accrue(goal.currentAmount, goal.amountDate, upTo, dailyCdiFactor(cdiAnnualPercent, goal.cdiPercent));
    return { ...goal, currentAmount, amountDate: upTo };
  });

  return { ...snapshot, creditCards, savingsGoals };
}
