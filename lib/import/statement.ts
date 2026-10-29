import type { PaymentMethod, StatementEntry, TransactionType } from '@/types/finance';

// Utilitários compartilhados pelos parsers de extrato (OFX, CSV) e pela extração por IA.

export const DEFAULT_IMPORT_CATEGORY = 'Outros';

/** Bancos brasileiros ainda exportam OFX/CSV em Windows-1252; UTF-8 inválido cai para ele. */
export function decodeText(bytes: Uint8Array): string {
  const text = (() => {
    try {
      return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    } catch {
      return new TextDecoder('windows-1252').decode(bytes);
    }
  })();
  return text.replace(/^﻿/, '');
}

/**
 * Aceita "1.234,56", "-45,90", "1234.56", "R$ 10,00", "(45,90)" e "45,90-".
 * Com "." e "," juntos, o último separador é o decimal; só "." com grupos de 3 dígitos é milhar.
 */
export function parseAmount(raw: string): number | null {
  let s = raw.replace(/R\$|\s| /g, '');
  if (!s) return null;
  let negative = false;
  if (/^\(.*\)$/.test(s)) {
    negative = true;
    s = s.slice(1, -1);
  }
  if (s.endsWith('-')) {
    negative = true;
    s = s.slice(0, -1);
  }
  if (s.startsWith('-')) {
    negative = !negative;
    s = s.slice(1);
  } else if (s.startsWith('+')) {
    s = s.slice(1);
  }

  const lastComma = s.lastIndexOf(',');
  const lastDot = s.lastIndexOf('.');
  if (lastComma >= 0 && lastDot >= 0) {
    const decimal = lastComma > lastDot ? ',' : '.';
    const thousands = decimal === ',' ? '.' : ',';
    s = s.split(thousands).join('').replace(decimal, '.');
  } else if (lastComma >= 0) {
    s = s.split('.').join('').replace(',', '.');
  } else if (lastDot >= 0 && /^\d{1,3}(\.\d{3})+$/.test(s)) {
    s = s.split('.').join('');
  }

  if (!/^\d+(\.\d+)?$/.test(s)) return null;
  const value = Number(s);
  if (!Number.isFinite(value)) return null;
  return negative ? -value : value;
}

/** dd/mm/aaaa, dd/mm/aa, dd-mm-aaaa, aaaa-mm-dd e aaaammdd (OFX) → YYYY-MM-DD. */
export function parseDate(raw: string): string | null {
  const s = raw.trim();
  let y: number;
  let m: number;
  let d: number;

  let match = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (match) {
    [y, m, d] = [Number(match[1]), Number(match[2]), Number(match[3])];
  } else if ((match = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2}|\d{4})$/.exec(s))) {
    [d, m, y] = [Number(match[1]), Number(match[2]), Number(match[3])];
    if (y < 100) y += 2000;
  } else if ((match = /^(\d{4})(\d{2})(\d{2})/.exec(s))) {
    [y, m, d] = [Number(match[1]), Number(match[2]), Number(match[3])];
  } else {
    return null;
  }

  const date = new Date(Date.UTC(y, m - 1, d));
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d) {
    return null;
  }
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

export function normalizeText(s: string): string {
  return s
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/** Extrato de conta: o meio de pagamento sai da descrição; cartão de crédito é escolhido na revisão. */
export function inferPaymentMethod(description: string): Exclude<PaymentMethod, 'credit_card'> {
  const d = normalizeText(description);
  if (/\bpix\b/.test(d)) return 'pix';
  if (/\b(ted|doc|transf|transferencia)/.test(d)) return 'bank_transfer';
  if (/\b(saque|deposito em dinheiro)\b/.test(d)) return 'cash';
  return 'debit';
}

/** Monta uma linha a partir do valor com sinal (negativo = saída). Valor zero é descartado. */
export function entryFromSigned(
  description: string,
  signedAmount: number,
  date: string,
): StatementEntry | null {
  const amount = Math.round(Math.abs(signedAmount) * 100) / 100;
  const cleanDescription = description.replace(/\s+/g, ' ').trim().slice(0, 200);
  if (amount === 0 || !cleanDescription) return null;
  const type: TransactionType = signedAmount < 0 ? 'expense' : 'income';
  return {
    description: cleanDescription,
    amount,
    type,
    date,
    category: DEFAULT_IMPORT_CATEGORY,
    paymentMethod: inferPaymentMethod(cleanDescription),
  };
}
