import { describe, expect, it } from 'vitest';

import { greeting } from '@/lib/greeting';
import { settingsPatchSchema } from '@/lib/finance-schemas';

describe('greeting', () => {
  it('usa o horário de Brasília e o nome', () => {
    expect(greeting('Ana', new Date('2026-10-31T12:00:00Z'))).toBe('Bom dia, Ana'); // 9h
    expect(greeting(' Ana ', new Date('2026-10-31T18:00:00Z'))).toBe('Boa tarde, Ana'); // 15h
    expect(greeting('', new Date('2026-10-31T23:30:00Z'))).toBe('Boa noite'); // 20h30
  });
});

describe('displayName', () => {
  it('é salvo sem espaços nas pontas e tem limite de tamanho', () => {
    expect(settingsPatchSchema.parse({ displayName: '  Ana ' })).toEqual({ displayName: 'Ana' });
    expect(() => settingsPatchSchema.parse({ displayName: 'x'.repeat(41) })).toThrow();
  });
});
