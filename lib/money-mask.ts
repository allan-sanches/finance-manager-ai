// Máscara dos campos de valor: o usuário digita só números e eles entram pela direita, como em
// maquininha ("2" → "0,02", "200000" → "2.000,00"). O mesmo formato vale para real e dólar; a
// moeda aparece só no prefixo do campo (R$ / US$).

const MAX_DIGITS = 13; // até 99.999.999.999,99

const NUMBER = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Texto digitado → texto mascarado. Vazio (ou só zeros) continua vazio para o placeholder aparecer. */
export function maskMoney(raw: string): string {
  const digits = raw.replace(/\D/g, '').replace(/^0+/, '').slice(0, MAX_DIGITS);
  if (!digits) return '';
  return NUMBER.format(Number(digits) / 100);
}

/** Número salvo → texto do campo (para edição). Zero ou vazio vira campo vazio. */
export function toMoneyInput(value: number | null | undefined): string {
  return value ? NUMBER.format(value) : '';
}

/** Texto mascarado → número. Campo vazio → null. */
export function parseMoneyInput(masked: string): number | null {
  const digits = masked.replace(/\D/g, '');
  if (!digits) return null;
  return Number(digits) / 100;
}
