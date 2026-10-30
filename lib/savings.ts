import type { SavingsGoal } from '@/types/finance';

export const USD = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'USD' });

/** Caixinhas mais usadas: escolher uma preenche a instituição e o % do CDI no formulário. */
export const SAVINGS_BANKS = [
  { name: 'Inter', cdiPercent: 82 },
  { name: 'Mercado Pago', cdiPercent: 120 },
] as const;

/** Taxa mensal (fração) de quem rende `cdiPercent`% do CDI, com o CDI anual em % a.a. */
export function monthlyRateFromCdi(cdiPercent: number, cdiAnnualPercent: number): number {
  const monthlyCdi = Math.pow(1 + cdiAnnualPercent / 100, 1 / 12) - 1;
  return monthlyCdi * (cdiPercent / 100);
}

/**
 * Rendimento bruto estimado em 1 mês: CDI anual convertido para mensal, vezes o % do CDI.
 * Estimativa (sem IR/IOF, CDI constante) — serve para comparar caixinhas, não para extrato.
 */
export function estimatedMonthlyYield(goal: SavingsGoal, cdiAnnualPercent: number): number | null {
  if (goal.currency !== 'BRL' || !goal.cdiPercent || goal.currentAmount <= 0) return null;
  return goal.currentAmount * monthlyRateFromCdi(goal.cdiPercent, cdiAnnualPercent);
}

/** Selic esperada pelo mercado (mediana do Focus) para o fim de cada ano, em % a.a. */
export type SelicOutlook = { year: number; rate: number }[];

// O CDI anda colado na Selic meta, uns 0,10 p.p. abaixo (ex.: Selic 13,75% → CDI 13,65%).
export const CDI_SELIC_SPREAD = 0.1;

/**
 * CDI anual (% a.a.) esperado no mês `month` (1 = o mês que começa hoje): sai do CDI de hoje e
 * caminha em linha reta até a Selic do Focus de cada fim de ano; depois do último ano, fica parado.
 * Sem Focus, é o CDI de hoje constante.
 */
export function expectedCdi(
  cdiNow: number,
  outlook: SelicOutlook,
  today: string,
  month: number,
): number {
  const anchors: [number, number][] = [[0, cdiNow]];
  for (const { year, rate } of [...outlook].sort((a, b) => a.year - b.year)) {
    const t = daysBetween(today, `${year}-12-31`) / DAYS_PER_MONTH;
    if (t > anchors[anchors.length - 1][0]) anchors.push([t, rate - CDI_SELIC_SPREAD]);
  }
  const t = month - 0.5; // meio do mês
  for (let i = 1; i < anchors.length; i++) {
    const [t0, v0] = anchors[i - 1];
    const [t1, v1] = anchors[i];
    if (t <= t1) return v0 + ((v1 - v0) * (t - t0)) / (t1 - t0);
  }
  return anchors[anchors.length - 1][1];
}

/** Taxa mensal (fração) da caixinha no mês `month`. */
export type MonthlyRateAt = (month: number) => number;

/**
 * Taxa mês a mês da caixinha: 0 para dólar ou sem % do CDI (só os aportes contam);
 * null se ela rende CDI mas o CDI ainda não chegou do Banco Central.
 */
export function goalRateAt(
  goal: Pick<SavingsGoal, 'currency' | 'cdiPercent'>,
  cdi: { annualRate: number; selicOutlook: SelicOutlook } | null,
  today: string,
): MonthlyRateAt | null {
  const cdiPercent = goal.cdiPercent;
  if (goal.currency !== 'BRL' || !cdiPercent) return () => 0;
  if (!cdi) return null;
  const cache = new Map<number, number>();
  return (month) => {
    let rate = cache.get(month);
    if (rate === undefined) {
      rate = monthlyRateFromCdi(cdiPercent, expectedCdi(cdi.annualRate, cdi.selicOutlook, today, month));
      cache.set(month, rate);
    }
    return rate;
  };
}

/**
 * IR regressivo de renda fixa sobre o ganho, pelo tempo de cada aplicação:
 * até 180 dias 22,5%, até 360 dias 20%, até 720 dias 17,5%, acima disso 15%.
 */
export function incomeTaxRate(monthsHeld: number): number {
  if (monthsHeld < 6) return 0.225;
  if (monthsHeld < 12) return 0.2;
  if (monthsHeld < 24) return 0.175;
  return 0.15;
}

export type GoalProjection = {
  /** Até o prazo da meta (null sem prazo ou com prazo já vencido). */
  atDeadline: {
    months: number;
    amount: number; // saldo líquido previsto (já sem IR) com o aporte atual
    yieldAmount: number; // rendimento líquido até lá
    taxAmount: number; // IR que seria retido se resgatasse tudo no prazo
    requiredContribution: number; // aporte mensal para ter a meta líquida no prazo (0 = já chega sem aportar)
  } | null;
  /** Mês em que o saldo líquido bate a meta no ritmo atual (aporte + rendimento); null se nunca chega. */
  reachDate: string | null;
};

const DAYS_PER_MONTH = 365.25 / 12;
const MAX_MONTHS = 50 * 12;

type Lot = { principal: number; value: number; month: number };

/**
 * Simula mês a mês: cada aplicação (o saldo de hoje e cada aporte, no fim do mês) rende a taxa
 * do mês e paga IR pela própria idade. O saldo de hoje conta como aplicado hoje — conservador.
 */
class Simulation {
  private lots: Lot[];
  month = 0;

  constructor(
    initial: number,
    private readonly contribution: number,
    private readonly rateAt: MonthlyRateAt,
  ) {
    this.lots = initial > 0 ? [{ principal: initial, value: initial, month: 0 }] : [];
  }

  step() {
    this.month++;
    const factor = 1 + this.rateAt(this.month);
    for (const lot of this.lots) lot.value *= factor;
    if (this.contribution > 0) {
      this.lots.push({ principal: this.contribution, value: this.contribution, month: this.month });
    }
  }

  totals() {
    let gross = 0;
    let tax = 0;
    for (const lot of this.lots) {
      gross += lot.value;
      tax += Math.max(0, lot.value - lot.principal) * incomeTaxRate(this.month - lot.month);
    }
    return { gross, tax, net: gross - tax };
  }
}

function netAt(pv: number, pmt: number, rateAt: MonthlyRateAt, months: number) {
  const sim = new Simulation(pv, pmt, rateAt);
  while (sim.month < months) sim.step();
  return sim.totals();
}

/**
 * Projeção com o CDI esperado mês a mês, aporte no fim de cada mês e IR regressivo descontado.
 * `today` entra como parâmetro para o cálculo ser determinístico nos testes.
 */
export function projectGoal(goal: SavingsGoal, rateAt: MonthlyRateAt, today: string): GoalProjection {
  const pv = goal.currentAmount;
  const pmt = goal.monthlyContribution ?? 0;
  const target = goal.targetAmount;

  let atDeadline: GoalProjection['atDeadline'] = null;
  const months = goal.deadline ? monthsBetween(today, goal.deadline) : 0;
  if (months > 0) {
    const { net, tax } = netAt(pv, pmt, rateAt, months);
    let requiredContribution = 0;
    if (netAt(pv, 0, rateAt, months).net < target) {
      // O líquido cresce com o aporte: busca binária até o centavo.
      let lo = 0;
      let hi = target;
      while (hi - lo > 0.005) {
        const mid = (lo + hi) / 2;
        if (netAt(pv, mid, rateAt, months).net >= target) hi = mid;
        else lo = mid;
      }
      requiredContribution = Math.round(hi * 100) / 100;
      if (netAt(pv, requiredContribution, rateAt, months).net < target) requiredContribution += 0.01;
    }
    atDeadline = { months, amount: net, yieldAmount: net - pv - pmt * months, taxAmount: tax, requiredContribution };
  }

  let reachDate: string | null = null;
  if (pv < target && (pmt > 0 || (pv > 0 && rateAt(1) > 0))) {
    const sim = new Simulation(pv, pmt, rateAt);
    while (sim.month < MAX_MONTHS) {
      sim.step();
      if (sim.totals().net >= target) {
        reachDate = addMonths(today, sim.month);
        break;
      }
    }
  }

  return { atDeadline, reachDate };
}

/** Meses completos de `fromISO` até `toISO` (0 se já passou). */
export function monthsBetween(fromISO: string, toISO: string): number {
  const [y1, m1, d1] = fromISO.split('-').map(Number);
  const [y2, m2, d2] = toISO.split('-').map(Number);
  return Math.max(0, (y2 - y1) * 12 + (m2 - m1) - (d2 < d1 ? 1 : 0));
}

/** Soma meses a uma data ISO; dia 31 em mês curto vira o último dia do mês. */
export function addMonths(iso: string, months: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  const target = new Date(Date.UTC(y, m - 1 + months, 1));
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(d, lastDay));
  return target.toISOString().slice(0, 10);
}

/** Resgate provável = dia do depósito + prazo. null se a caixinha não tem prazo ou data. */
export function redemptionDate(goal: SavingsGoal): string | null {
  if (!goal.lockDays || !goal.depositDate) return null;
  const date = new Date(`${goal.depositDate}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + goal.lockDays);
  return date.toISOString().slice(0, 10);
}

/** Dias corridos de `fromISO` até `toISO` (negativo se já passou). */
export function daysBetween(fromISO: string, toISO: string): number {
  const ms = Date.parse(`${toISO}T00:00:00Z`) - Date.parse(`${fromISO}T00:00:00Z`);
  return Math.round(ms / 86_400_000);
}
