import { describe, expect, it } from 'vitest';

import {
  creditCardInvoiceSchema,
  debtPatchSchema,
  savingsGoalPatchSchema,
  savingsGoalSchema,
  shoppingItemPatchSchema,
  shoppingItemSchema,
} from '@/lib/finance-schemas';

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

describe('shoppingItemSchema (lista de desejos)', () => {
  const wish = { id: 'w', name: 'Fone', listType: 'wishlist', isPurchased: false };

  it('editar só o preço não apaga foto nem link', () => {
    expect(shoppingItemPatchSchema.parse({ estimatedPrice: 10 })).toEqual({ estimatedPrice: 10 });
  });

  it('aceita foto em data URL ou https e link http(s)', () => {
    expect(
      shoppingItemSchema.parse({ ...wish, imageUrl: 'data:image/jpeg;base64,AAAA', productUrl: 'http://loja.example/x' }),
    ).toMatchObject({ imageUrl: 'data:image/jpeg;base64,AAAA', productUrl: 'http://loja.example/x' });
    expect(shoppingItemSchema.parse({ ...wish, imageUrl: 'https://cdn.example/a.jpg' }).imageUrl).toBe(
      'https://cdn.example/a.jpg',
    );
  });

  it('recusa links que rodariam script', () => {
    expect(() => shoppingItemSchema.parse({ ...wish, productUrl: 'javascript:alert(1)' })).toThrow();
    expect(() => shoppingItemSchema.parse({ ...wish, imageUrl: 'data:text/html;base64,AAAA' })).toThrow();
    expect(() => shoppingItemSchema.parse({ ...wish, imageUrl: 'http://cdn.example/a.jpg' })).toThrow();
  });
});

describe('creditCardInvoiceSchema', () => {
  const base = { id: 'i', creditCardId: 'c', closingDate: '2026-11-05', dueDate: '2026-11-12', amount: 10 };

  it('fatura sem pagamento fica com paymentDate null', () => {
    expect(creditCardInvoiceSchema.parse(base).paymentDate).toBeNull();
  });

  it('recusa vencimento antes do fechamento', () => {
    expect(creditCardInvoiceSchema.safeParse({ ...base, dueDate: '2026-11-01' }).success).toBe(false);
  });
});
