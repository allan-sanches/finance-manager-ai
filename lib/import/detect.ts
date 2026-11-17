// Quem manda um arquivo pelo Marx não escolhe o tipo: o cabeçalho do PDF diz o que ele é.
// Só o começo do texto conta — um extrato pode ter "PIX SERASA" no meio, mas não no título.

export type DetectedDocumentKind = 'statement' | 'scr' | 'serasa';

const HEADER_CHARS = 1500;

export function detectPdfKind(layoutText: string): DetectedDocumentKind {
  const header = layoutText.slice(0, HEADER_CHARS);
  if (/registrato|relat[óo]rio de empr[ée]stimos e financiamentos|m[êe]s de refer[êe]ncia:/i.test(header)) {
    return 'scr';
  }
  if (/serasa/i.test(header)) return 'serasa';
  return 'statement';
}
