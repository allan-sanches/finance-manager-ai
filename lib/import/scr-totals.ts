import { parseAmount } from '@/lib/import/statement';

// Conferência independente da IA: o SCR traz uma linha-resumo por mês
// ("Mês de referência: 09/2026   R$ 8.538,62   R$ 3.382,12 ...") com o total em dia e vencido.
// Lida do texto com layout (lib/import/pdf-text.ts), a posição de cada valor diz a coluna.

export type ScrTotals = {
  referenceDate: string; // YYYY-MM-01
  currentAmount: number;
  overdueAmount: number;
};

const MONEY = /R\$\s?-?[\d.]+,\d{2}/g;

/** Totais do mês mais recente do relatório, ou null se o texto não tiver o cabeçalho esperado. */
export function readScrTotals(layoutText: string): ScrTotals | null {
  const lines = layoutText.split('\n');
  const header = lines.find((l) => l.includes('Em dia') && l.includes('Vencida'));
  if (!header) return null;
  const currentCol = header.indexOf('Em dia');
  const overdueCol = header.indexOf('Vencida');
  const nextCol = header.indexOf('Crédito a liberar');

  let latest: ScrTotals | null = null;
  for (const line of lines) {
    const month = /Mês de referência:\s*(\d{2})\/(\d{4})/.exec(line);
    if (!month) continue;
    const totals: ScrTotals = {
      referenceDate: `${month[2]}-${month[1]}-01`,
      currentAmount: 0,
      overdueAmount: 0,
    };
    for (const match of line.matchAll(MONEY)) {
      const value = parseAmount(match[0]) ?? 0;
      // Cada valor pertence à coluna cujo título começa antes dele e mais perto.
      const at = match.index;
      if (nextCol >= 0 && at >= nextCol - 2) continue;
      if (at >= overdueCol - 2) totals.overdueAmount = value;
      else if (at >= currentCol - 4) totals.currentAmount = value;
    }
    if (!latest || totals.referenceDate > latest.referenceDate) latest = totals;
  }
  return latest;
}
