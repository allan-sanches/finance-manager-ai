import { describe, expect, it } from 'vitest';

import { debtPatchSchema, savingsGoalPatchSchema, savingsGoalSchema } from '@/lib/finance-schemas';

describe('patches não preenchem campos ausentes', () => {
  it('editar só o nome da caixinha não mexe em moeda, CDI ou prazo', () => {
    expect(savingsGoalPatchSchema.parse({ name: 'Porquinho' })).toEqual({ name: 'Porquinho' });
  });

  it('editar só a anotação da dívida não reseta o status', () => {
    expect(debtPatchSchema.parse({ notes: 'oferta de 800' })).toEqual({ notes: 'oferta de 800' });
  });

  it('caixinha nova sem moeda vira BRL e campos opcionais viram null', () => {
    const goal = savingsGoalSchema.parse({ id: 'g', name: 'X', targetAmount: 10, currentAmount: 0 });
    expect(goal).toMatchObject({ currency: 'BRL', cdiPercent: null, lockDays: null, depositDate: null, monthlyContribution: null });
  });
});
