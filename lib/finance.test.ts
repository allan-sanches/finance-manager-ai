import { describe, expect, it } from 'vitest';

import { todayISO } from '@/lib/finance';

describe('todayISO', () => {
  it('usa o fuso de Brasília, não UTC', () => {
    // 01:30 UTC do dia 30 = 22:30 do dia 29 em Brasília
    expect(todayISO(new Date('2026-10-30T01:30:00Z'))).toBe('2026-10-29');
  });

  it('retorna o mesmo dia no meio do dia', () => {
    expect(todayISO(new Date('2026-10-29T15:00:00Z'))).toBe('2026-10-29');
  });
});
