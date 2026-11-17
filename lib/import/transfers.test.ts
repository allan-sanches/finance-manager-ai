import { describe, expect, it } from 'vitest';

import { looksLikeTransfer, pairCreditPix } from '@/lib/import/transfers';

describe('pairCreditPix', () => {
  const e = (description: string, amount: number, type: 'income' | 'expense', date = '2026-10-26') => ({
    description,
    amount,
    type,
    date,
  });

  it('junta cada reposição ao Pix de mesmo valor e dia, mesmo com outros no meio', () => {
    const out = pairCreditPix([
      e('Pix enviado: GOLD', 200, 'expense'),
      e('Credito liberado: Pix no credito', 200, 'income'),
      e('Pix enviado: CLARO', 263.14, 'expense'),
      e('Pix enviado: PRIME', 100, 'expense'),
      e('Pix enviado: Mattos', 200, 'expense'),
      e('Credito liberado: Pix no credito', 100, 'income'),
    ]);
    expect(out.map((x) => [x.description, Boolean(x.paidByCard)])).toEqual([
      ['Pix enviado: GOLD', true],
      ['Pix enviado: CLARO', false],
      ['Pix enviado: PRIME', true],
      ['Pix enviado: Mattos', false],
    ]);
  });

  it('reposição sem Pix correspondente fica como movimentação (não some do saldo)', () => {
    const out = pairCreditPix([e('Credito liberado: Pix no credito', 50, 'income')]);
    expect(out).toEqual([{ ...e('Credito liberado: Pix no credito', 50, 'income'), isTransfer: true }]);
  });

  it('não junta com Pix de outro dia', () => {
    const out = pairCreditPix([e('Pix enviado: X', 30, 'expense', '2026-10-25'), e('Pix no credito', 30, 'income')]);
    expect(out.map((x) => Boolean(x.paidByCard))).toEqual([false, false]);
  });
});

describe('looksLikeTransfer', () => {
  it.each([
    'Aplicacao: "CDB CREDITO BANCO INTER S A"',
    'Resgate: "CDB Porq Obj BANCO INTER S A"',
    'Aplicação CDB Porquinho',
    'Deposito Global Account',
    'Debito Conta Global De Inv',
    'Credito Conta Global De Inv',
    'Pagamento efetuado: "Pagamento fatura cartao Inter"',
    'PGTO FATURA NUBANK',
    'TED mesma titularidade',
  ])('movimentação: %s', (description) => {
    expect(looksLikeTransfer(description)).toBe(true);
  });

  it.each([
    'IOF Global Account',
    'Debito Iof Conta Global De Inv',
    'Pix enviado: "Cp :14796606-UBER DO BRASIL TECNOLOGIA LTDA"',
    'Compra no debito: "No estabelecimento RAIA4147"',
    'Compra Capitalizacao Inter',
    'Tarifa pacote de serviços',
  ])('gasto ou receita comum: %s', (description) => {
    expect(looksLikeTransfer(description)).toBe(false);
  });
});
