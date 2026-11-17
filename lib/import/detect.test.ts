import { describe, expect, it } from 'vitest';

import { detectPdfKind } from '@/lib/import/detect';

describe('detectPdfKind', () => {
  it('reconhece o relatório do Registrato pelo cabeçalho', () => {
    expect(detectPdfKind('Banco Central do Brasil\nRelatório de Empréstimos e Financiamentos (SCR)\n...')).toBe('scr');
    expect(detectPdfKind('REGISTRATO\nMês de referência: 09/2026   R$ 8.538,62')).toBe('scr');
  });

  it('reconhece o relatório do Serasa pelo cabeçalho', () => {
    expect(detectPdfKind('Serasa Limpa Nome\nMinhas dívidas\n...')).toBe('serasa');
  });

  it('extrato com "SERASA" só numa transação lá embaixo continua extrato', () => {
    const lines = Array.from({ length: 60 }, (_, i) => `${i + 1}/10/2026   PIX ENVIADO - MERCADO   -45,90`);
    lines.push('28/10/2026   PIX ENVIADO - SERASA S.A.   -120,00');
    expect(detectPdfKind(`Extrato de conta corrente\n${lines.join('\n')}`)).toBe('statement');
  });

  it('sem marca conhecida é extrato', () => {
    expect(detectPdfKind('Nubank\nExtrato do período 01/10/2026 a 31/10/2026')).toBe('statement');
  });
});
