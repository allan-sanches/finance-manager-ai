import { normalizeText } from '@/lib/import/statement';
import type { StatementEntry } from '@/types/finance';

// Linhas de extrato que só mudam o dinheiro de lugar: entram como "movimentação" (isTransfer),
// fora de entradas e saídas. Sem isso, aplicar R$ 1.000 no CDB e resgatar no dia seguinte vira
// R$ 1.000 de gasto e R$ 1.000 de receita, e pagar a fatura conta de novo as compras do cartão.

const RULES: ReadonlyArray<RegExp> = [
  // Investimentos: aplicação, resgate, CDB/LCI/LCA, Tesouro, poupança, porquinho/caixinha
  /\b(aplicacao|resgate)\b/,
  /\b(cdb|lci|lca|tesouro direto|poupanca|caixinha|porquinho|porq obj)\b/,
  // Conta em dólar (Inter Global Account e afins): o depósito é câmbio, não gasto
  /\b(deposito|credito|debito) (na |da )?(global account|conta global)/,
  // Pagamento da fatura do cartão: as compras já entram pela fatura
  /\b(pagamento|pgto|pag)\b.*\bfatura\b/,
  /\bfatura\b.*\bcart(ao|oes)\b.*\bpag/,
  // Entre contas da mesma pessoa
  /\b(mesma titularidade|entre contas|transferencia propria)\b/,
];

// Imposto e tarifa são custo de verdade, mesmo quando a linha cita a conta global ou o CDB.
const ALWAYS_EXPENSE = /\b(iof|tarifa|imposto|ir sobre)\b/;

export function looksLikeTransfer(description: string): boolean {
  const d = normalizeText(description);
  if (ALWAYS_EXPENSE.test(d)) return false;
  return RULES.some((rule) => rule.test(d));
}

const CREDIT_RELEASE = /credito liberado|pix no credito/;

/**
 * "Pix no crédito" (Inter e outros): o Pix sai da conta e, logo depois, o banco devolve o mesmo
 * valor ("Crédito liberado") e cobra no cartão. Na conta o par soma zero; o gasto é do cartão.
 * Junta cada reposição ao Pix de mesmo valor e data (o mais próximo antes dela): o Pix vira
 * compra no cartão (`paidByCard`) e a reposição sai. Reposição sem par fica como movimentação,
 * para o saldo da conta continuar batendo.
 */
export function pairCreditPix<T extends Pick<StatementEntry, 'date' | 'amount' | 'type' | 'description'>>(
  entries: ReadonlyArray<T>,
): Array<T & Pick<StatementEntry, 'paidByCard' | 'isTransfer'>> {
  const out: Array<T & Pick<StatementEntry, 'paidByCard' | 'isTransfer'>> = entries.map((e) => ({ ...e }));
  const drop = new Set<number>();
  out.forEach((e, i) => {
    if (e.type !== 'income' || !CREDIT_RELEASE.test(normalizeText(e.description))) return;
    const cents = Math.round(e.amount * 100);
    for (let j = i - 1; j >= 0; j--) {
      const p = out[j];
      if (drop.has(j) || p.paidByCard || p.type !== 'expense' || p.date !== e.date) continue;
      if (Math.round(p.amount * 100) !== cents) continue;
      p.paidByCard = true;
      drop.add(i);
      return;
    }
    e.isTransfer = true;
  });
  return out.filter((_, i) => !drop.has(i));
}
