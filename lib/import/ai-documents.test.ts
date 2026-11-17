import { describe, expect, it } from 'vitest';

import { parseDebtOutput, parseInvoiceOutput, parseStatementOutput } from '@/lib/import/ai-documents';
import { redactPersonalIds } from '@/lib/import/pdf-text';

describe('parseDebtOutput', () => {
  it('monta DTOs novos, arredonda centavos e descarta linhas sem valor', () => {
    const raw = {
      entries: [
        {
          creditor: 'BANCO EXEMPLO S.A.',
          description: 'Outros empréstimos',
          currentAmount: '653.924',
          overdueAmount: 0,
          referenceDate: null,
          extra: 'não deve passar',
        },
        { creditor: 'X', description: 'Limite', currentAmount: 0, overdueAmount: 0 },
        { creditor: 'Y', description: 'Cartão', currentAmount: -5, overdueAmount: 10 },
      ],
    };
    expect(parseDebtOutput(raw, '2026-09-01')).toEqual([
      {
        creditor: 'BANCO EXEMPLO S.A.',
        description: 'Outros empréstimos',
        currentAmount: 653.92,
        overdueAmount: 0,
        referenceDate: '2026-09-01',
      },
      { creditor: 'Y', description: 'Cartão', currentAmount: 0, overdueAmount: 10, referenceDate: '2026-09-01' },
    ]);
  });

  it('rejeita resposta fora do formato', () => {
    expect(parseDebtOutput({ dividas: [] }, '2026-09-01')).toBeNull();
    expect(parseDebtOutput(null, '2026-09-01')).toBeNull();
  });
});

describe('parseStatementOutput', () => {
  it('descarta a reposição do "Pix no crédito" e mantém o Pix enviado', () => {
    const pix = { date: '2026-10-26', amount: 200, category: 'Outros', paymentMethod: 'pix' };
    const raw = {
      entries: [
        { ...pix, description: 'Pix enviado: GOLD TECNOLOGIA', type: 'expense' },
        { ...pix, description: 'Crédito liberado: "Pix no crédito"', type: 'income' },
        { ...pix, description: 'Pix no credito', type: 'income' },
      ],
    };
    expect(parseStatementOutput(raw)?.map((e) => e.description)).toEqual(['Pix enviado: GOLD TECNOLOGIA']);
  });

  it('normaliza categoria e meio de pagamento desconhecidos', () => {
    const raw = {
      entries: [
        {
          date: '2026-10-05',
          description: 'Uber',
          amount: 23.4,
          type: 'expense',
          category: 'Mobilidade',
          paymentMethod: 'credit_card',
        },
      ],
    };
    expect(parseStatementOutput(raw)).toEqual([
      {
        date: '2026-10-05',
        description: 'Uber',
        amount: 23.4,
        type: 'expense',
        category: 'Outros',
        paymentMethod: 'debit',
      },
    ]);
  });

  it('rejeita data inválida', () => {
    const raw = {
      entries: [{ date: '05/10', description: 'x', amount: 1, type: 'expense', category: 'Outros', paymentMethod: 'pix' }],
    };
    expect(parseStatementOutput(raw)).toBeNull();
  });
});

it('remove nome e CPF do texto enviado à IA', () => {
  const text = [
    '        Nome: FULANO DE TAL',
    '        CPF/CNPJ: 123.456.789-09',
    'Relatório emitido por: 12345678909 em 29/10/2026 15:37',
    'BANCO EXEMPLO S.A.     R$ 1.520,38',
  ].join('\n');
  const redacted = redactPersonalIds(text);
  expect(redacted).not.toMatch(/FULANO|123\.456|12345678909/);
  expect(redacted).toContain('R$ 1.520,38');
});

describe('parseInvoiceOutput', () => {
  it('lê fechamento, vencimento e total arredondado', () => {
    expect(parseInvoiceOutput({ closingDate: '2026-11-03', dueDate: '2026-11-10', amount: 2000.004 })).toEqual({
      kind: 'invoice',
      closingDate: '2026-11-03',
      dueDate: '2026-11-10',
      amount: 2000,
      entries: [],
      warnings: [],
    });
  });

  it('lê os lançamentos, descarta linhas inválidas e troca categoria desconhecida por Outros', () => {
    const preview = parseInvoiceOutput(
      {
        closingDate: '2026-11-03',
        dueDate: '2026-11-10',
        amount: 100,
        entries: [
          { date: '2026-10-20', description: 'IFOOD *REST', amount: 45.904, type: 'expense', category: 'Alimentação' },
          { date: '2026-10-21', description: 'ESTORNO LOJA', amount: 10, type: 'income', category: 'Inventada' },
          { date: 'ontem', description: 'sem data', amount: 5, type: 'expense', category: 'Outros' },
          { date: '2026-10-22', description: 'zerada', amount: 0, type: 'expense', category: 'Outros' },
        ],
      },
      ['Alimentação', 'Outros'],
    );
    expect(preview?.entries).toEqual([
      { date: '2026-10-20', description: 'IFOOD *REST', amount: 45.9, type: 'expense', category: 'Alimentação' },
      { date: '2026-10-21', description: 'ESTORNO LOJA', amount: 10, type: 'income', category: 'Outros' },
    ]);
  });

  it('campo ausente vira null com aviso', () => {
    const preview = parseInvoiceOutput({ closingDate: null, dueDate: '2026-11-10', amount: 'abc' });
    expect(preview).toMatchObject({ closingDate: null, dueDate: '2026-11-10', amount: null });
    expect(preview?.warnings).toHaveLength(1);
  });

  it('descarta vencimento antes do fechamento', () => {
    const preview = parseInvoiceOutput({ closingDate: '2026-11-10', dueDate: '2026-11-01', amount: 50 });
    expect(preview?.dueDate).toBeNull();
    expect(preview?.warnings[0]).toMatch(/vencimento/);
  });
});
