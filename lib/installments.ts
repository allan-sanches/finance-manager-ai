import type { CreditCard, CreditCardInvoice, Transaction, TransactionDraft } from '@/types/finance';

// Compra parcelada no cartão: cada parcela vira uma transação, com a data dentro da fatura em que
// cai. Assim o limite, os gastos do mês e as próximas faturas saem da mesma conta, sem digitar
// valor de fatura futura à mão.

export const MAX_INSTALLMENTS = 24;

const pad = (n: number) => String(n).padStart(2, '0');

/** Mesma data k meses depois; dia que não existe no mês (31/02) vira o último dia dele. */
export function addMonths(dateISO: string, months: number): string {
  const [y, m, d] = dateISO.split('-').map(Number);
  const total = y * 12 + (m - 1) + months;
  const year = Math.floor(total / 12);
  const month = (total % 12) + 1;
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return `${year}-${pad(month)}-${pad(Math.min(d, lastDay))}`;
}

export const dayBefore = (dateISO: string) =>
  new Date(Date.parse(`${dateISO}T00:00:00Z`) - 86_400_000).toISOString().slice(0, 10);

const newGroupId = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `parc-${Date.now()}-${Math.random()}`;

/** "C&A" + 2 de 3 → "C&A (2/3)". Tira um "(1/3)" ou "01/03" que já esteja no fim. */
export function installmentLabel(description: string, number: number, count: number): string {
  const base = description.replace(/\s*\(?\b\d{1,2}\s*\/\s*\d{1,2}\)?\s*$/, '').trim() || description;
  return `${base} (${number}/${count})`;
}

/**
 * Divide uma compra em `count` parcelas mensais, a partir da data da compra. `amountIs` diz se o
 * valor do rascunho é o total (os centavos que sobram vão na primeira) ou o de cada parcela.
 */
export function splitPurchase(
  draft: TransactionDraft,
  count: number,
  amountIs: 'total' | 'installment',
): TransactionDraft[] {
  if (count <= 1) return [draft];
  const cents = Math.round(draft.amount * 100);
  const each = amountIs === 'total' ? Math.floor(cents / count) : cents;
  const first = amountIs === 'total' ? cents - each * (count - 1) : cents;
  const group = newGroupId();
  return Array.from({ length: count }, (_, i) => ({
    ...draft,
    description: installmentLabel(draft.description, i + 1, count),
    amount: (i === 0 ? first : each) / 100,
    date: addMonths(draft.date, i),
    // Parcela futura ainda não foi paga, mesmo que a primeira esteja.
    isPaid: i === 0 ? draft.isPaid : false,
    installmentGroupId: group,
    installmentNumber: i + 1,
    installmentCount: count,
  }));
}

/**
 * Parcelas que ainda vão cair, a partir de uma linha da fatura ("parcela 3 de 10" numa fatura que
 * fecha em `closingDate`): a 4ª na fatura seguinte, e assim por diante, sempre na véspera do
 * fechamento (dentro do ciclo dela).
 */
export function remainingInstallments(
  draft: TransactionDraft,
  number: number,
  count: number,
  closingDate: string,
  groupId: string = newGroupId(),
): TransactionDraft[] {
  const out: TransactionDraft[] = [];
  for (let k = number + 1; k <= count; k++) {
    out.push({
      ...draft,
      description: installmentLabel(draft.description, k, count),
      date: dayBefore(addMonths(closingDate, k - number)),
      isPaid: false,
      installmentGroupId: groupId,
      installmentNumber: k,
      installmentCount: count,
    });
  }
  return out;
}

type CardRef = Pick<CreditCard, 'id' | 'closingDay' | 'dueDay'>;
type InvoiceRef = Pick<CreditCardInvoice, 'creditCardId' | 'closingDate' | 'dueDate' | 'amount' | 'paymentDate' | 'recordedAt'>;
type PurchaseRef = Pick<Transaction, 'paymentMethod' | 'creditCardId' | 'date' | 'amount' | 'type' | 'createdAt'>;

export type UpcomingInvoice = {
  closingDate: string;
  dueDate: string;
  amount: number;
  /** informed: valor que veio do banco (mais compras lançadas depois); projected: soma das parcelas. */
  source: 'informed' | 'projected';
};

/** Fechamento do mês de `monthISO` (YYYY-MM-DD qualquer): o informado nas faturas, senão o dia do cartão. */
function closingInMonth(card: CardRef, invoices: ReadonlyArray<InvoiceRef>, monthISO: string): { closing: string; due: string } {
  const month = monthISO.slice(0, 7);
  const informed = invoices.find((i) => i.closingDate.slice(0, 7) === month);
  if (informed) return { closing: informed.closingDate, due: informed.dueDate };
  const closing = `${month}-${pad(Math.min(card.closingDay, 28))}`;
  const dueMonth = card.dueDay > card.closingDay ? closing : addMonths(closing, 1);
  return { closing, due: `${dueMonth.slice(0, 7)}-${pad(Math.min(card.dueDay, 28))}` };
}

/**
 * Próximas faturas do cartão, da que está aberta hoje em diante. Fatura informada vale o valor do
 * banco mais o que foi lançado depois dele; as outras são a soma das compras/parcelas do ciclo
 * (do fechamento anterior até a véspera do dela).
 */
export function upcomingInvoices(
  card: CardRef,
  transactions: ReadonlyArray<PurchaseRef>,
  allInvoices: ReadonlyArray<InvoiceRef>,
  today: string,
  months = 6,
): UpcomingInvoice[] {
  const invoices = allInvoices.filter((i) => i.creditCardId === card.id);
  const purchases = transactions.filter((t) => t.paymentMethod === 'credit_card' && t.creditCardId === card.id);
  // Ciclo atual: o primeiro fechamento a partir de hoje.
  let cycle = closingInMonth(card, invoices, today);
  if (cycle.closing <= today) cycle = closingInMonth(card, invoices, addMonths(`${today.slice(0, 7)}-01`, 1));
  let previousClosing = closingInMonth(card, invoices, addMonths(`${cycle.closing.slice(0, 7)}-01`, -1)).closing;

  const out: UpcomingInvoice[] = [];
  for (let i = 0; i < months; i++) {
    const { closing, due } = cycle;
    const informed = invoices.find((inv) => inv.closingDate === closing);
    if (informed?.paymentDate) {
      previousClosing = closing;
      cycle = closingInMonth(card, invoices, addMonths(`${closing.slice(0, 7)}-01`, 1));
      continue;
    }
    let cents = 0;
    for (const t of purchases) {
      if (t.date < previousClosing || t.date >= closing) continue;
      // Na fatura informada, só soma o que foi lançado depois do valor do banco.
      if (informed && !(informed.recordedAt && t.createdAt && t.createdAt > informed.recordedAt)) continue;
      cents += Math.round(t.amount * 100) * (t.type === 'income' ? -1 : 1);
    }
    const amount = (informed ? Math.round(informed.amount * 100) + cents : cents) / 100;
    if (amount > 0) out.push({ closingDate: closing, dueDate: due, amount: Math.max(0, amount), source: informed ? 'informed' : 'projected' });
    previousClosing = closing;
    cycle = closingInMonth(card, invoices, addMonths(`${closing.slice(0, 7)}-01`, 1));
  }
  return out;
}
