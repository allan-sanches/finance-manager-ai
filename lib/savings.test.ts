import { describe, expect, it } from 'vitest';

import {
  addMonths,
  daysBetween,
  estimatedMonthlyYield,
  expectedCdi,
  goalRateAt,
  incomeTaxRate,
  monthsBetween,
  projectGoal,
  redemptionDate,
} from '@/lib/savings';
import type { SavingsGoal } from '@/types/finance';

const goal = (overrides: Partial<SavingsGoal> = {}): SavingsGoal => ({
  id: 'g',
  name: 'Caixinha',
  targetAmount: 10_000,
  currentAmount: 10_000,
  currency: 'BRL',
  cdiPercent: 100,
  ...overrides,
});

describe('estimatedMonthlyYield', () => {
  it('converte o CDI anual para mensal e aplica o %', () => {
    // 12% a.a. → ~0,9489% a.m.; 10 mil a 100% do CDI ≈ R$ 94,89
    expect(estimatedMonthlyYield(goal(), 12)).toBeCloseTo(94.89, 1);
    expect(estimatedMonthlyYield(goal({ cdiPercent: 120 }), 12)).toBeCloseTo(113.87, 1);
  });

  it('não estima dólar, caixinha sem % ou vazia', () => {
    expect(estimatedMonthlyYield(goal({ currency: 'USD' }), 12)).toBeNull();
    expect(estimatedMonthlyYield(goal({ cdiPercent: null }), 12)).toBeNull();
    expect(estimatedMonthlyYield(goal({ currentAmount: 0 }), 12)).toBeNull();
  });
});

describe('redemptionDate', () => {
  it('soma o prazo ao dia do depósito, virando o mês', () => {
    expect(redemptionDate(goal({ lockDays: 30, depositDate: '2026-10-15' }))).toBe('2026-11-14');
    expect(redemptionDate(goal({ lockDays: 90, depositDate: '2026-10-29' }))).toBe('2027-01-27');
  });

  it('sem prazo ou sem data não há resgate previsto', () => {
    expect(redemptionDate(goal({ lockDays: 30 }))).toBeNull();
    expect(redemptionDate(goal({ depositDate: '2026-10-01' }))).toBeNull();
  });
});

it('daysBetween conta dias corridos', () => {
  expect(daysBetween('2026-10-29', '2026-11-14')).toBe(16);
  expect(daysBetween('2026-10-29', '2026-10-20')).toBe(-9);
});

const flat = (r: number) => () => r;
const cdiNow = { annualRate: 12, selicOutlook: [] };

describe('goalRateAt', () => {
  it('dólar ou sem % do CDI só contam os aportes', () => {
    expect(goalRateAt(goal({ currency: 'USD' }), cdiNow, '2026-10-29')!(1)).toBe(0);
    expect(goalRateAt(goal({ cdiPercent: null }), null, '2026-10-29')!(1)).toBe(0);
  });

  it('rende CDI mas o CDI não chegou: sem taxa', () => {
    expect(goalRateAt(goal(), null, '2026-10-29')).toBeNull();
  });

  it('Mercado Pago (120%) rende mais por mês que Inter (82%)', () => {
    const inter = goalRateAt(goal({ cdiPercent: 82 }), cdiNow, '2026-10-29')!(1);
    const mp = goalRateAt(goal({ cdiPercent: 120 }), cdiNow, '2026-10-29')!(1);
    expect(mp / inter).toBeCloseTo(120 / 82, 6);
  });
});

describe('expectedCdi', () => {
  const outlook = [
    { year: 2027, rate: 11.75 },
    { year: 2026, rate: 13.25 },
  ];

  it('sem Focus, CDI de hoje constante', () => {
    expect(expectedCdi(13.65, [], '2026-10-29', 1)).toBe(13.65);
    expect(expectedCdi(13.65, [], '2026-10-29', 60)).toBe(13.65);
  });

  it('caminha do CDI de hoje até a Selic do Focus menos o spread e depois fica parado', () => {
    const first = expectedCdi(13.65, outlook, '2026-10-29', 1);
    expect(first).toBeLessThan(13.65);
    expect(first).toBeGreaterThan(13.15);
    expect(expectedCdi(13.65, outlook, '2026-10-29', 8)).toBeLessThan(13.15);
    expect(expectedCdi(13.65, outlook, '2026-10-29', 15)).toBeCloseTo(11.65, 6);
    expect(expectedCdi(13.65, outlook, '2026-10-29', 120)).toBeCloseTo(11.65, 6);
  });
});

it('incomeTaxRate segue a tabela regressiva', () => {
  expect([0, 5, 6, 11, 12, 23, 24, 60].map(incomeTaxRate)).toEqual([
    0.225, 0.225, 0.2, 0.2, 0.175, 0.175, 0.15, 0.15,
  ]);
});

describe('projectGoal', () => {
  const today = '2026-10-29';

  it('sem rendimento: aporte linear até o prazo e aporte necessário', () => {
    const p = projectGoal(
      goal({ currentAmount: 1000, targetAmount: 7000, monthlyContribution: 500, deadline: '2027-10-29' }),
      flat(0),
      today,
    );
    expect(p.atDeadline).toEqual({
      months: 12,
      amount: 7000,
      yieldAmount: 0,
      taxAmount: 0,
      requiredContribution: 500,
    });
    expect(p.reachDate).toBe('2027-10-29');
  });

  it('desconta o IR pela idade da aplicação', () => {
    // 10 mil a 1% a.m. por 24 meses: bruto 12.697,35; ganho de 2.697,35 paga 15%.
    const p = projectGoal(goal({ targetAmount: 20_000, deadline: '2028-10-29' }), flat(0.01), today);
    expect(p.atDeadline!.taxAmount).toBeCloseTo(2697.35 * 0.15, 1);
    expect(p.atDeadline!.amount).toBeCloseTo(12697.35 - 2697.35 * 0.15, 1);
  });

  it('com rendimento chega antes e precisa de aporte menor', () => {
    const rateAt = goalRateAt(goal({ cdiPercent: 120 }), cdiNow, today)!;
    const base = { currentAmount: 1000, targetAmount: 7000, deadline: '2027-10-29' };
    const p = projectGoal(goal({ ...base, monthlyContribution: 500 }), rateAt, today);
    expect(p.atDeadline!.amount).toBeGreaterThan(7000);
    expect(p.atDeadline!.yieldAmount).toBeCloseTo(p.atDeadline!.amount - 7000, 6);
    expect(p.atDeadline!.requiredContribution).toBeLessThan(500);
    // Com o aporte calculado, o líquido no prazo bate a meta (arredondado para cima no centavo).
    const exact = projectGoal(
      goal({ ...base, monthlyContribution: p.atDeadline!.requiredContribution }),
      rateAt,
      today,
    );
    expect(exact.atDeadline!.amount).toBeGreaterThanOrEqual(7000);
    expect(exact.atDeadline!.amount).toBeLessThan(7000.2);
    expect(p.reachDate! <= '2027-10-29').toBe(true);
  });

  it('só o rendimento já leva à meta: aporte necessário 0', () => {
    const p = projectGoal(
      goal({ currentAmount: 9950, targetAmount: 10_000, deadline: '2027-10-29' }),
      flat(0.01),
      today,
    );
    expect(p.atDeadline!.requiredContribution).toBe(0);
    expect(p.reachDate).toBe('2026-11-29');
  });

  it('sem aporte, sem rendimento ou prazo vencido', () => {
    const p = projectGoal(goal({ currentAmount: 0, deadline: '2026-01-01' }), flat(0), today);
    expect(p).toEqual({ atDeadline: null, reachDate: null });
  });

  it('meta já batida não tem data de chegada', () => {
    expect(projectGoal(goal({ monthlyContribution: 100 }), flat(0.01), today).reachDate).toBeNull();
  });
});

it('monthsBetween conta meses completos', () => {
  expect(monthsBetween('2026-10-29', '2027-10-29')).toBe(12);
  expect(monthsBetween('2026-10-29', '2027-10-28')).toBe(11);
  expect(monthsBetween('2026-10-29', '2026-09-01')).toBe(0);
});

it('addMonths ajusta o fim do mês', () => {
  expect(addMonths('2026-01-31', 1)).toBe('2026-02-28');
  expect(addMonths('2026-10-29', 3)).toBe('2027-01-29');
});
