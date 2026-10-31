import { describe, expect, it } from 'vitest';

import { parseCsv } from '@/lib/import/csv';
import { findDuplicateCardEntries, findDuplicateEntries } from '@/lib/import/dedupe';
import { looksLikeOfx, parseOfx } from '@/lib/import/ofx';
import { readScrTotals } from '@/lib/import/scr-totals';
import { decodeText, inferPaymentMethod, parseAmount, parseDate } from '@/lib/import/statement';
import type { Transaction } from '@/types/finance';

describe('parseAmount', () => {
  it.each([
    ['1.234,56', 1234.56],
    ['-45,90', -45.9],
    ['R$ 10,00', 10],
    ['(45,90)', -45.9],
    ['45,90-', -45.9],
    ['1234.56', 1234.56],
    ['1,234.56', 1234.56],
    ['1.234', 1234],
    ['-12.5', -12.5],
  ])('%s → %d', (raw, expected) => {
    expect(parseAmount(raw)).toBe(expected);
  });

  it('rejeita texto que não é número', () => {
    expect(parseAmount('Saldo')).toBeNull();
    expect(parseAmount('')).toBeNull();
  });
});

describe('parseDate', () => {
  it.each([
    ['28/10/2026', '2026-10-28'],
    ['1/2/26', '2026-02-01'],
    ['2026-10-28', '2026-10-28'],
    ['20261028120000[-3:BRT]', '2026-10-28'],
  ])('%s → %s', (raw, expected) => {
    expect(parseDate(raw)).toBe(expected);
  });

  it('rejeita datas impossíveis', () => {
    expect(parseDate('31/02/2026')).toBeNull();
    expect(parseDate('Total')).toBeNull();
  });
});

describe('decodeText', () => {
  it('cai para Windows-1252 quando o arquivo não é UTF-8', () => {
    const latin1 = new Uint8Array([0x50, 0x41, 0x47, 0x54, 0x4f, 0x20, 0x43, 0xc9, 0x55]); // "PAGTO CÉU"
    expect(decodeText(latin1)).toBe('PAGTO CÉU');
  });
});

it('infere o meio de pagamento pela descrição', () => {
  expect(inferPaymentMethod('PIX ENVIADO Fulano')).toBe('pix');
  expect(inferPaymentMethod('TED 001 Maria')).toBe('bank_transfer');
  expect(inferPaymentMethod('Transferência recebida')).toBe('bank_transfer');
  expect(inferPaymentMethod('SAQUE 24H')).toBe('cash');
  expect(inferPaymentMethod('COMPRA CARTAO MERCADO')).toBe('debit');
});

const OFX_SGML = `OFXHEADER:100
DATA:OFXSGML
CHARSET:1252

<OFX>
<BANKMSGSRSV1><STMTTRNRS><STMTRS>
<BANKTRANLIST>
<STMTTRN>
<TRNTYPE>DEBIT
<DTPOSTED>20261005000000[-3:BRT]
<TRNAMT>-45.90
<FITID>1
<MEMO>PIX ENVIADO - Padaria &amp; Cia
</STMTTRN>
<STMTTRN>
<TRNTYPE>CREDIT
<DTPOSTED>20261006
<TRNAMT>3200.00
<FITID>2
<NAME>SALARIO
<MEMO>SALARIO
</STMTTRN>
<STMTTRN>
<TRNTYPE>OTHER
<DTPOSTED>20261007
<TRNAMT>0.00
<MEMO>Lançamento zerado
</STMTTRN>
</BANKTRANLIST>
</STMTRS></STMTTRNRS></BANKMSGSRSV1>
</OFX>`;

describe('parseOfx', () => {
  it('lê OFX 1.x (SGML), separa entrada/saída e ignora valor zero', () => {
    expect(looksLikeOfx(OFX_SGML)).toBe(true);
    const { entries, skipped } = parseOfx(OFX_SGML);
    expect(skipped).toBe(1);
    expect(entries).toEqual([
      {
        description: 'PIX ENVIADO - Padaria & Cia',
        amount: 45.9,
        type: 'expense',
        date: '2026-10-05',
        category: 'Outros',
        paymentMethod: 'pix',
      },
      {
        description: 'SALARIO',
        amount: 3200,
        type: 'income',
        date: '2026-10-06',
        category: 'Outros',
        paymentMethod: 'debit',
      },
    ]);
  });

  it('lê OFX 2.x (XML) de cartão', () => {
    const xml = `<?xml version="1.0"?><OFX><CREDITCARDMSGSRSV1><CCSTMTTRNRS><CCSTMTRS><BANKTRANLIST>
      <STMTTRN><TRNTYPE>DEBIT</TRNTYPE><DTPOSTED>20261010</DTPOSTED><TRNAMT>-1234.5</TRNAMT><MEMO>LOJA X</MEMO></STMTTRN>
    </BANKTRANLIST></CCSTMTRS></CCSTMTTRNRS></CREDITCARDMSGSRSV1></OFX>`;
    expect(parseOfx(xml).entries).toMatchObject([
      { description: 'LOJA X', amount: 1234.5, type: 'expense', date: '2026-10-10' },
    ]);
  });
});

describe('parseCsv', () => {
  it('lê CSV com vírgula e cabeçalho simples (estilo Nubank conta)', () => {
    const csv = 'Data,Valor,Identificador,Descrição\n05/10/2026,-45.90,abc,"Compra no débito - Mercado, Centro"\n06/10/2026,3200.00,def,Transferência recebida';
    const result = parseCsv(csv);
    expect(result.ok && result.entries).toMatchObject([
      { date: '2026-10-05', amount: 45.9, type: 'expense', description: 'Compra no débito - Mercado, Centro' },
      { date: '2026-10-06', amount: 3200, type: 'income', paymentMethod: 'bank_transfer' },
    ]);
  });

  it('acha o cabeçalho depois de linhas de título e ignora saldos (estilo Inter)', () => {
    const csv = [
      'Extrato Conta Corrente',
      'Período ;01/10/2026 a 31/10/2026',
      '',
      'Data Lançamento;Histórico;Descrição;Valor;Saldo',
      '05/10/2026;Pix enviado;Padaria;-12,50;1.000,00',
      '06/10/2026;Compra no debito;Farmácia;-1.234,56;-234,56',
      'Saldo do dia;;;;-234,56',
    ].join('\r\n');
    const result = parseCsv(csv);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.skipped).toBe(1);
    expect(result.entries.map((e) => [e.description, e.amount, e.type])).toEqual([
      ['Pix enviado - Padaria', 12.5, 'expense'],
      ['Compra no debito - Farmácia', 1234.56, 'expense'],
    ]);
  });

  it('lê colunas separadas de crédito e débito', () => {
    const csv = 'Data;Descrição;Crédito;Débito\n01/10/2026;Salário;5.000,00;\n02/10/2026;Aluguel;;1.800,00';
    const result = parseCsv(csv);
    expect(result.ok && result.entries.map((e) => [e.amount, e.type])).toEqual([
      [5000, 'income'],
      [1800, 'expense'],
    ]);
  });

  it('explica quando não reconhece as colunas', () => {
    const result = parseCsv('foo;bar\n1;2');
    expect(result.ok).toBe(false);
  });
});

describe('findDuplicateEntries', () => {
  const existing = [
    {
      id: 't1',
      description: 'PIX ENVIADO  padaria',
      amount: 45.9,
      type: 'expense',
      category: 'Alimentação',
      paymentMethod: 'pix',
      date: '2026-10-05',
      isFixed: false,
      isPaid: true,
    },
  ] satisfies Transaction[];

  it('marca só uma ocorrência por transação existente, ignorando caixa e espaços', () => {
    const entry = {
      description: 'Pix enviado padaria',
      amount: 45.9,
      type: 'expense' as const,
      date: '2026-10-05',
      category: 'Outros',
      paymentMethod: 'pix' as const,
    };
    const dupes = findDuplicateEntries([entry, entry, { ...entry, amount: 46 }], existing);
    expect([...dupes]).toEqual([0]);
  });
});

describe('readScrTotals', () => {
  // Mesmo layout que lib/import/pdf-text.ts gera para o PDF do Registrato (dados fictícios).
  const layout = [
    '        Período pesquisado:      08/2026 a 09/2026',
    '                                                                                               Dívidas                                         Outros compromissos financeiros',
    '        Instituição',
    '                                                                            Em dia                    Vencida                    Crédito a liberar         Coobrigações               Limites de crédito',
    '        Mês de referência: 08/2026                                          R$ 100,00                                                                                                 R$ 50,00',
    '        Mês de referência: 09/2026                                          R$ 8.538,62               R$ 3.382,12                                                                     R$ 6.090,43',
    '        BANCO EXEMPLO S.A.                                                                               R$ 203,01',
  ].join('\n');

  it('lê os totais do mês mais recente pela coluna de cada valor', () => {
    expect(readScrTotals(layout)).toEqual({
      referenceDate: '2026-09-01',
      currentAmount: 8538.62,
      overdueAmount: 3382.12,
    });
  });

  it('valor só na coluna "Vencida" não vira "Em dia"', () => {
    const onlyOverdue = layout.replace(
      'R$ 8.538,62               R$ 3.382,12',
      '                          R$ 3.382,12',
    );
    expect(readScrTotals(onlyOverdue)).toMatchObject({ currentAmount: 0, overdueAmount: 3382.12 });
  });

  it('devolve null sem o cabeçalho do relatório', () => {
    expect(readScrTotals('qualquer coisa')).toBeNull();
  });
});

describe('findDuplicateCardEntries', () => {
  const existing = (o: Partial<Transaction>): Transaction => ({
    id: Math.random().toString(36),
    description: 'Jantar',
    amount: 45.9,
    type: 'expense',
    category: 'Alimentação',
    paymentMethod: 'credit_card',
    creditCardId: 'c1',
    date: '2026-10-20',
    isFixed: false,
    isPaid: false,
    ...o,
  });
  const line = { date: '2026-10-21', type: 'expense' as const, amount: 45.9 };

  it('casa por valor e tipo com até 1 dia de diferença, ignorando a descrição', () => {
    expect(findDuplicateCardEntries([line], [existing({})], 'c1')).toEqual(new Set([0]));
    expect(findDuplicateCardEntries([{ ...line, date: '2026-10-23' }], [existing({})], 'c1').size).toBe(0);
  });

  it('só considera compras no crédito do mesmo cartão, e cada uma casa uma vez', () => {
    expect(findDuplicateCardEntries([line], [existing({ creditCardId: 'c2' })], 'c1').size).toBe(0);
    expect(findDuplicateCardEntries([line], [existing({ paymentMethod: 'debit', creditCardId: null })], 'c1').size).toBe(0);
    expect(findDuplicateCardEntries([line, line], [existing({})], 'c1')).toEqual(new Set([0]));
  });
});
