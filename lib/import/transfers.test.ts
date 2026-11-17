import { describe, expect, it } from 'vitest';

import { looksLikeTransfer } from '@/lib/import/transfers';

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
