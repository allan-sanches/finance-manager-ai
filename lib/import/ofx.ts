import { entryFromSigned, parseDate } from '@/lib/import/statement';
import type { StatementEntry } from '@/types/finance';

// OFX 1.x é SGML (tags sem fechamento) e o 2.x é XML; ler tag a tag dentro de cada <STMTTRN>
// funciona para os dois e para extrato de conta (<STMTRS>) ou de cartão (<CCSTMTRS>).

export type OfxParseResult = { entries: StatementEntry[]; skipped: number };

export function looksLikeOfx(text: string): boolean {
  return /<OFX>/i.test(text) || /^\s*OFXHEADER:/i.test(text);
}

function readTag(block: string, tag: string): string | null {
  const match = new RegExp(`<${tag}>([^<\\r\\n]*)`, 'i').exec(block);
  return match ? decodeEntities(match[1].trim()) : null;
}

function decodeEntities(s: string): string {
  return s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');
}

/** TRNAMT não tem separador de milhar: o ponto (ou a vírgula, em bancos fora do padrão) é sempre decimal. */
function parseOfxAmount(raw: string): number | null {
  const s = raw.replace(/\s/g, '').replace(',', '.');
  if (!/^[+-]?\d+(\.\d+)?$/.test(s)) return null;
  return Number(s);
}

export function parseOfx(text: string): OfxParseResult {
  const entries: StatementEntry[] = [];
  let skipped = 0;

  const blocks = text.split(/<STMTTRN>/i).slice(1);
  for (const rawBlock of blocks) {
    const block = rawBlock.split(/<\/STMTTRN>/i)[0];
    const amount = parseOfxAmount(readTag(block, 'TRNAMT') ?? '');
    const date = parseDate(readTag(block, 'DTPOSTED') ?? '');
    const memo = readTag(block, 'MEMO');
    const name = readTag(block, 'NAME');
    // Alguns bancos repetem o mesmo texto em NAME e MEMO; outros usam só um dos dois.
    const description = [name, memo]
      .filter((v, i, all): v is string => Boolean(v) && all.indexOf(v) === i)
      .join(' - ');

    const entry = amount !== null && date ? entryFromSigned(description, amount, date) : null;
    if (entry) entries.push(entry);
    else skipped += 1;
  }

  return { entries, skipped };
}
