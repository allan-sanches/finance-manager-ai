import { normalizeText } from '@/lib/import/statement';

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
