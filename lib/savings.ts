import type { SavingsGoal } from '@/types/finance';

export const USD = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'USD' });

/**
 * Rendimento bruto estimado em 1 mês: CDI anual convertido para mensal, vezes o % do CDI.
 * Estimativa (sem IR/IOF, CDI constante) — serve para comparar caixinhas, não para extrato.
 */
export function estimatedMonthlyYield(goal: SavingsGoal, cdiAnnualPercent: number): number | null {
  if (goal.currency !== 'BRL' || !goal.cdiPercent || goal.currentAmount <= 0) return null;
  const monthlyCdi = Math.pow(1 + cdiAnnualPercent / 100, 1 / 12) - 1;
  return goal.currentAmount * monthlyCdi * (goal.cdiPercent / 100);
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
