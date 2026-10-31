import {
  accountBalance,
  addDays,
  cardLimit,
  cardUsage,
  debtsOnDashboard,
  expensesByCategory,
  invoiceOutflows,
  nextOpenInvoice,
  PAYMENT_METHOD_LABEL,
  securedCardIds,
  securedCardSavings,
  summarizeDebts,
  summarizeMonth,
  withoutHiddenCategories,
} from '@/lib/finance';
import type { MarketQuotes } from '@/lib/marx/quotes';
import { totalSavedBrl } from '@/lib/savings';
import { monthTitle, shiftMonth } from '@/lib/transaction-months';
import { priceTrend, sortWishes } from '@/lib/wishlist';
import type { FinanceSnapshot } from '@/types/finance';

// Retrato das finanças do usuário em texto, para o system prompt do Marx. Texto em linhas gasta
// bem menos tokens que JSON e a IA lê igual. Tudo aqui já respeita as categorias ocultas, como o
// dashboard; saldos de conta e limite de cartão usam tudo, porque são dinheiro real.

const MONTHS_OF_HISTORY = 3;
const RECENT_DAYS = 60;
const MAX_RECENT = 80;
const MAX_PENDING = 25;
const MAX_WISHES = 30;
const MAX_HOUSEHOLD = 40;
const MAX_DEBTS = 15;

// Sem o modo privado: o formatador do app vira "R$ ••••" no navegador, aqui é sempre o valor.
const money = (value: number, currency: 'BRL' | 'USD' = 'BRL') =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency }).format(value);

const pct = (value: number) => `${value.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}%`;

export function buildFinanceContext(snapshot: FinanceSnapshot, quotes: MarketQuotes, today: string): string {
  const { transactions, creditCards, creditCardInvoices, bankAccounts, savingsGoals, shoppingItems, debts, settings } =
    snapshot;
  const visible = withoutHiddenCategories(transactions, settings.hiddenCategories);
  const secured = securedCardIds(creditCards);
  const { realized, expected } = invoiceOutflows(creditCardInvoices, today, secured);
  const payments = [...realized, ...expected];
  const cardName = new Map(creditCards.map((c) => [c.id, c.name]));
  const accountName = new Map(bankAccounts.map((a) => [a.id, a.name]));
  const usdRate = quotes.currencies.find((q) => q.name.startsWith('Dólar Americano'))?.brl ?? null;
  const lines: string[] = [];
  const section = (title: string, body: string[], empty: string) =>
    lines.push('', `## ${title}`, ...(body.length ? body : [empty]));

  // Meses
  const currentKey = today.slice(0, 7);
  const months: string[] = [];
  for (let i = 0; i < MONTHS_OF_HISTORY; i++) {
    const key = shiftMonth(currentKey, -i);
    const s = summarizeMonth(visible, key, payments, secured);
    const top = expensesByCategory(visible, key)
      .slice(0, 8)
      .map((c) => `${c.name} ${money(c.value)}`)
      .join('; ');
    months.push(
      `- ${monthTitle(key)}${i === 0 ? ' (mês atual, inclui o previsto até o fim do mês)' : ''}: entradas ${money(s.income)}, saídas ${money(s.expense)}, resultado ${money(s.balance)}.` +
        (top ? ` Gastos por categoria (inclui compras no cartão): ${top}.` : ''),
    );
  }
  section('Resumo dos meses', months, 'Sem lançamentos.');

  // Contas a pagar
  const pending = visible
    .filter((t) => !t.isPaid && t.type === 'expense' && t.date.slice(0, 7) <= currentKey)
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, MAX_PENDING)
    .map((t) => `- ${t.date}${t.date < today ? ' (ATRASADA)' : ''} | ${t.description} | ${money(t.amount)} | ${t.category}`);
  section('Contas em aberto (até o fim do mês)', pending, 'Nenhuma conta em aberto.');

  // Lançamentos recentes
  const since = addDays(today, -RECENT_DAYS);
  const recent = visible
    .filter((t) => t.date >= since)
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, MAX_RECENT)
    .map((t) => {
      const where = t.creditCardId
        ? ` (${cardName.get(t.creditCardId) ?? 'cartão'})`
        : t.bankAccountId
          ? ` (${accountName.get(t.bankAccountId) ?? 'conta'})`
          : '';
      const flags = [t.isFixed && 'fixa', !t.isPaid && 'em aberto', t.isTransfer && 'movimentação']
        .filter(Boolean)
        .join(', ');
      return `- ${t.date} | ${t.description} | ${t.type === 'expense' ? '-' : '+'}${money(t.amount)} | ${t.category} | ${PAYMENT_METHOD_LABEL[t.paymentMethod]}${where}${flags ? ` | ${flags}` : ''}`;
    });
  section(`Lançamentos dos últimos ${RECENT_DAYS} dias (mais novos primeiro)`, recent, 'Nenhum lançamento recente.');

  // Contas bancárias
  section(
    'Contas bancárias (id | nome | saldo de hoje)',
    bankAccounts.map((a) => `- ${a.id} | ${a.name} | ${money(accountBalance(a, transactions).balance)}`),
    'Nenhuma conta cadastrada.',
  );

  // Cartões
  section(
    'Cartões de crédito (id | nome | limite | usado | disponível | fecha/vence)',
    creditCards.map((c) => {
      const limit = cardLimit(c, savingsGoals);
      const usage = cardUsage(c.id, transactions, creditCardInvoices, today);
      const next = nextOpenInvoice(creditCardInvoices, c.id);
      return (
        `- ${c.id} | ${c.name} | ${money(limit)} | ${money(usage.used)} | ${money(limit - usage.used)} | dia ${c.closingDay}/dia ${c.dueDay}` +
        (next ? ` | próxima fatura em aberto vence ${next.dueDate}` : '') +
        (c.securedLimit ? ' | limite garantido por investimento' : '')
      );
    }),
    'Nenhum cartão cadastrado.',
  );

  // Caixinhas
  const saved = totalSavedBrl(savingsGoals, usdRate);
  const securedSavings = securedCardSavings(creditCards, savingsGoals).total;
  section(
    'Caixinhas de reserva (metas)',
    [
      `Total guardado: ${money(saved.total + securedSavings)}${saved.usd > 0 && saved.usdInBrl == null ? ` + ${money(saved.usd, 'USD')} (sem cotação)` : ''}.`,
      ...savingsGoals.map((g) => {
        const progress = g.targetAmount > 0 ? ` (${Math.round((g.currentAmount / g.targetAmount) * 100)}%)` : '';
        const extras = [
          g.institution,
          g.cdiPercent != null && `${g.cdiPercent}% do CDI`,
          g.annualRate != null && `${pct(g.annualRate)} a.a.`,
          g.monthlyContribution && `aporte planejado ${money(g.monthlyContribution, g.currency)}/mês`,
          g.deadline && `prazo ${g.deadline}`,
        ]
          .filter(Boolean)
          .join(', ');
        return `- ${g.name}: ${money(g.currentAmount, g.currency)} de ${money(g.targetAmount, g.currency)}${progress}${extras ? ` | ${extras}` : ''}`;
      }),
    ],
    '',
  );

  // Lista de desejos
  const wishes = sortWishes(shoppingItems.filter((i) => i.listType === 'wishlist' && !i.isPurchased))
    .slice(0, MAX_WISHES)
    .map((w) => {
      const trend = priceTrend(w);
      const price = w.estimatedPrice != null ? money(w.estimatedPrice) : 'sem preço';
      const extra = trend
        ? [
            trend.isLowest && 'menor preço já visto',
            trend.change !== 0 && `${trend.change < 0 ? 'caiu' : 'subiu'} ${pct(Math.abs(trend.changePercent))} na última leitura`,
          ]
            .filter(Boolean)
            .join(', ')
        : '';
      return `- ${w.name} | ${price} | prioridade ${w.priority ?? 'medium'}${extra ? ` | ${extra}` : ''}`;
    });
  section('Lista de desejos (ainda não comprados)', wishes, 'Lista de desejos vazia.');

  // Lista de compras da casa
  const household = shoppingItems
    .filter((i) => i.listType === 'household' && !i.isPurchased)
    .slice(0, MAX_HOUSEHOLD)
    .map((i) => `- ${i.name}${i.estimatedPrice != null ? ` (${money(i.estimatedPrice)})` : ''}`);
  section('Lista de compras da casa (pendentes)', household, 'Lista de compras vazia.');

  // Dívidas
  const activeDebts = debtsOnDashboard(debts, settings);
  const debtSummary = summarizeDebts(activeDebts);
  section(
    'Dívidas acompanhadas',
    activeDebts.length
      ? [
          `Total: ${money(debtSummary.total)} (${money(debtSummary.overdue)} vencido).`,
          ...activeDebts
            .slice(0, MAX_DEBTS)
            .map((d) => `- ${d.creditor} | ${d.description} | em dia ${money(d.currentAmount)} | vencido ${money(d.overdueAmount)}`),
        ]
      : [],
    'Nenhuma dívida acompanhada.',
  );

  // Mercado
  const market = [
    ...quotes.currencies.map(
      (q) =>
        `- ${q.name}: ${money(q.brl)}${q.changePercent != null ? ` (${q.changePercent >= 0 ? '+' : ''}${pct(q.changePercent)} no dia)` : ''} — atualizado ${q.updatedAt}`,
    ),
    quotes.cdiAnnual && `- CDI: ${pct(quotes.cdiAnnual.rate)} a.a. (${quotes.cdiAnnual.date})`,
    quotes.selicTarget && `- Meta Selic: ${pct(quotes.selicTarget.rate)} a.a. (${quotes.selicTarget.date})`,
  ].filter((l): l is string => Boolean(l));
  section('Cotações e juros de agora', market, 'Cotações indisponíveis no momento.');

  return lines.join('\n').trim();
}
