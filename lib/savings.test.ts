import { describe, expect, it } from 'vitest';

import { daysBetween, estimatedMonthlyYield, redemptionDate } from '@/lib/savings';
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
