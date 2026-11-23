import { describe, expect, it } from 'vitest';

import { isAiSpendAuthorized, utcDay } from '@/lib/ai-spend-token';

const TOKEN = 'a'.repeat(40);

describe('isAiSpendAuthorized', () => {
  it('aceita só o token exato no cabeçalho Bearer', () => {
    expect(isAiSpendAuthorized(`Bearer ${TOKEN}`, TOKEN)).toBe(true);
    expect(isAiSpendAuthorized(`Bearer ${TOKEN}b`, TOKEN)).toBe(false);
    expect(isAiSpendAuthorized(`Bearer ${'b'.repeat(40)}`, TOKEN)).toBe(false);
    expect(isAiSpendAuthorized(TOKEN, TOKEN)).toBe(false);
    expect(isAiSpendAuthorized(`Basic ${TOKEN}`, TOKEN)).toBe(false);
    expect(isAiSpendAuthorized(null, TOKEN)).toBe(false);
    expect(isAiSpendAuthorized('', TOKEN)).toBe(false);
  });

  it('sem token configurado, ou com token curto, ninguém entra', () => {
    expect(isAiSpendAuthorized('Bearer ', undefined)).toBe(false);
    expect(isAiSpendAuthorized('Bearer undefined', undefined)).toBe(false);
    expect(isAiSpendAuthorized('Bearer curto', 'curto')).toBe(false);
    expect(isAiSpendAuthorized(`Bearer ${'a'.repeat(31)}`, 'a'.repeat(31))).toBe(false);
  });
});

describe('utcDay', () => {
  it('devolve o dia em UTC', () => {
    expect(utcDay(Date.UTC(2026, 10, 23, 23, 59))).toBe('2026-11-23');
    expect(utcDay(Date.UTC(2026, 10, 24, 0, 0))).toBe('2026-11-24');
  });
});
