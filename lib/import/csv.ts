import {
  entryFromSigned,
  normalizeText,
  parseAmount,
  parseDate,
} from '@/lib/import/statement';
import type { StatementEntry } from '@/types/finance';

// Cada banco exporta um CSV diferente (Nubank usa ",", Inter ";" e linhas de cabeçalho antes da
// tabela). Em vez de um layout por banco, procuramos a linha de cabeçalho pelos nomes das colunas.

export type CsvParseResult =
  | { ok: true; entries: StatementEntry[]; skipped: number }
  | { ok: false; error: string };

const DATE_COLUMN = /^(data|date|dt)\b/;
const DESCRIPTION_COLUMN =
  /^(descricao|historico|lancamento|title|titulo|estabelecimento|memo|description|detalhe)/;
const AMOUNT_COLUMN = /^(valor|amount|quantia|value)/;
const CREDIT_COLUMN = /^(credito|entrada)/;
const DEBIT_COLUMN = /^(debito|saida)/;

function detectDelimiter(lines: ReadonlyArray<string>): string {
  const candidates = [';', ',', '\t'];
  const score = (d: string) =>
    lines.slice(0, 20).reduce((sum, line) => sum + (line.split(d).length - 1), 0);
  return candidates.reduce((best, d) => (score(d) > score(best) ? d : best));
}

/** Divide uma linha respeitando aspas ("a;b" continua sendo um campo). */
export function splitCsvLine(line: string, delimiter: string): string[] {
  const out: string[] = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (quoted) {
      if (ch === '"' && line[i + 1] === '"') {
        field += '"';
        i++;
      } else if (ch === '"') {
        quoted = false;
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      quoted = true;
    } else if (ch === delimiter) {
      out.push(field);
      field = '';
    } else {
      field += ch;
    }
  }
  out.push(field);
  return out.map((f) => f.trim());
}

type Columns = {
  date: number;
  description: number[];
  amount: number | null;
  credit: number | null;
  debit: number | null;
};

function findColumns(header: ReadonlyArray<string>): Columns | null {
  const names = header.map(normalizeText);
  const first = (re: RegExp) => {
    const i = names.findIndex((n) => re.test(n));
    return i >= 0 ? i : null;
  };
  const date = first(DATE_COLUMN);
  const amount = first(AMOUNT_COLUMN);
  const credit = first(CREDIT_COLUMN);
  const debit = first(DEBIT_COLUMN);
  const description = names
    .map((n, i) => (DESCRIPTION_COLUMN.test(n) ? i : -1))
    .filter((i) => i >= 0);

  if (date === null || description.length === 0) return null;
  if (amount === null && (credit === null || debit === null)) return null;
  return { date, description, amount, credit, debit };
}

export function parseCsv(text: string): CsvParseResult {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length === 0) return { ok: false, error: 'O arquivo CSV está vazio.' };

  const delimiter = detectDelimiter(lines);
  const headerIndex = lines.findIndex((l) => findColumns(splitCsvLine(l, delimiter)) !== null);
  if (headerIndex < 0) {
    return {
      ok: false,
      error:
        'Não encontrei as colunas de data, descrição e valor nesse CSV. Tente o OFX ou o PDF do extrato.',
    };
  }
  const columns = findColumns(splitCsvLine(lines[headerIndex], delimiter))!;

  const entries: StatementEntry[] = [];
  let skipped = 0;
  for (const line of lines.slice(headerIndex + 1)) {
    const cells = splitCsvLine(line, delimiter);
    const date = parseDate(cells[columns.date] ?? '');
    const description = columns.description
      .map((i) => cells[i])
      .filter((v, i, all): v is string => Boolean(v) && all.indexOf(v) === i)
      .join(' - ');

    let amount: number | null;
    if (columns.amount !== null) {
      amount = parseAmount(cells[columns.amount] ?? '');
    } else {
      // Colunas separadas de crédito/débito: o débito vira negativo mesmo se vier sem sinal.
      const credit = parseAmount(cells[columns.credit!] ?? '') ?? 0;
      const debit = parseAmount(cells[columns.debit!] ?? '') ?? 0;
      amount = credit !== 0 ? Math.abs(credit) : debit !== 0 ? -Math.abs(debit) : null;
    }

    const entry = date && amount !== null ? entryFromSigned(description, amount, date) : null;
    if (entry) entries.push(entry);
    else skipped += 1; // linhas de saldo, totais e rodapé
  }

  return { ok: true, entries, skipped };
}
