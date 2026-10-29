import { describe, expect, it } from 'vitest';

import { parseDebtOutput, parseStatementOutput } from '@/lib/import/ai-documents';
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
