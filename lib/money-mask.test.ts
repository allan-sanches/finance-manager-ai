import { describe, expect, it } from 'vitest';

import { maskMoney, parseMoneyInput, toMoneyInput } from '@/lib/money-mask';

describe('maskMoney', () => {
  it.each([
    ['', ''],
    ['0', ''],
    ['2', '0,02'],
    ['200000', '2.000,00'],
    ['R$ 1.234,567', '12.345,67'],
    ['123456789', '1.234.567,89'],
  ])('%s → %s', (raw, expected) => {
    expect(maskMoney(raw)).toBe(expected);
  });
});

describe('toMoneyInput / parseMoneyInput', () => {
  it('ida e volta', () => {
    expect(toMoneyInput(2000)).toBe('2.000,00');
    expect(toMoneyInput(45.9)).toBe('45,90');
    expect(toMoneyInput(0)).toBe('');
    expect(parseMoneyInput('2.000,00')).toBe(2000);
    expect(parseMoneyInput('45,90')).toBe(45.9);
    expect(parseMoneyInput('')).toBeNull();
  });
});
