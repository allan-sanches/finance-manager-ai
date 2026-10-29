import 'server-only';

import { getDocumentProxy } from 'unpdf';

// O texto "corrido" de um PDF perde as colunas: no SCR, "R$ 203,01" sozinho não diz se é dívida
// em dia ou vencida. Aqui cada item é posicionado pela coordenada na página já girada (o SCR vem
// em paisagem, rotate 90) e as linhas são remontadas com espaços, como o `pdftotext -layout`.

const MAX_PAGES = 40;
const LINE_TOLERANCE = 3; // pontos PDF: itens com Y tão próximo assim estão na mesma linha
const POINTS_PER_CHAR = 4; // ~210 colunas numa página A4 em paisagem

type Positioned = { x: number; y: number; str: string };

export class PdfWithoutTextError extends Error {
  constructor() {
    super('PDF sem texto extraível (provavelmente escaneado).');
  }
}

export async function extractPdfLayoutText(bytes: Uint8Array): Promise<string> {
  const pdf = await getDocumentProxy(bytes);
  try {
    const pages: string[] = [];
    for (let n = 1; n <= Math.min(pdf.numPages, MAX_PAGES); n++) {
      const page = await pdf.getPage(n);
      const [a, b, c, d, e, f] = page.getViewport({ scale: 1 }).transform;
      const content = await page.getTextContent();

      const items: Positioned[] = [];
      for (const item of content.items) {
        if (!('str' in item) || !item.str.trim()) continue;
        const [, , , , tx, ty] = item.transform as number[];
        // Matriz do viewport: leva do espaço do PDF (origem embaixo) para a tela (origem no topo).
        items.push({ x: a * tx + c * ty + e, y: b * tx + d * ty + f, str: item.str });
      }
      pages.push(layoutLines(items));
    }
    const text = pages.join('\n\n').trim();
    if (!text) throw new PdfWithoutTextError();
    return text;
  } finally {
    await pdf.loadingTask.destroy();
  }
}

export function layoutLines(items: ReadonlyArray<Positioned>): string {
  const lines: { y: number; items: Positioned[] }[] = [];
  for (const item of [...items].sort((p, q) => p.y - q.y || p.x - q.x)) {
    const line = lines.find((l) => Math.abs(l.y - item.y) <= LINE_TOLERANCE);
    if (line) line.items.push(item);
    else lines.push({ y: item.y, items: [item] });
  }

  return lines
    .map((line) => {
      let out = '';
      for (const item of line.items.sort((p, q) => p.x - q.x)) {
        const column = Math.max(0, Math.round(item.x / POINTS_PER_CHAR));
        out = out.length < column ? out.padEnd(column) : out ? `${out} ` : out;
        out += item.str;
      }
      return out.trimEnd();
    })
    .join('\n');
}

/**
 * Nome, CPF e números de 11 dígitos (o Registrato imprime o CPF sem máscara no rodapé) não vão
 * para a IA: nenhum deles é necessário para extrair as dívidas ou os lançamentos.
 */
export function redactPersonalIds(text: string): string {
  return text
    .replace(/^(\s*Nome\s*:).*$/gim, '$1 [NOME]')
    .replace(/\b\d{3}\.\d{3}\.\d{3}-\d{2}\b/g, '[CPF]')
    .replace(/\b\d{11}\b/g, '[CPF]');
}
