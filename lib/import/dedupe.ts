import { normalizeText } from '@/lib/import/statement';
import type { StatementEntry, Transaction } from '@/types/finance';

type Comparable = Pick<Transaction, 'date' | 'type' | 'amount' | 'description'>;

const cents = (amount: number) => Math.round(amount * 100);
const keyOf = (t: Comparable) => [t.date, t.type, cents(t.amount), normalizeText(t.description)].join('|');

const DAY_MS = 86_400_000;
const daysApart = (a: string, b: string) =>
  Math.abs(Date.parse(`${a}T00:00:00Z`) - Date.parse(`${b}T00:00:00Z`)) / DAY_MS;

// Palavras que todo extrato repete e não dizem quem é a outra ponta.
const STOPWORDS = new Set(['pix', 'enviado', 'recebido', 'compra', 'debito', 'credito', 'estabelecimento', 'ltda']);
const words = (s: string) =>
  new Set(
    normalizeText(s)
      .split(/[^a-z0-9]+/)
      .filter((w) => w.length >= 3 && !STOPWORDS.has(w) && !/^\d+$/.test(w)),
  );

/** 0 a 1: quanto as duas descrições têm em comum ("UBER DO BRASIL" × "Uber" > 0). */
export function descriptionSimilarity(a: string, b: string): number {
  const wa = words(a);
  const wb = words(b);
  if (wa.size === 0 || wb.size === 0) return 0;
  let shared = 0;
  for (const w of wa) if (wb.has(w)) shared++;
  return shared / Math.min(wa.size, wb.size);
}

/**
 * Índices das linhas do extrato que já existem como transação. Cada transação existente cobre
 * uma linha só (o extrato com dois Pix de R$ 100 no dia e um no app desmarca um).
 *
 * 1. Igual: mesma data, tipo, valor e descrição.
 * 2. Parecido: mesmo tipo e valor, com até 1 dia de diferença — a descrição da IA muda a cada
 *    leitura ("Pix enviado - Uber" × "UBER DO BRASIL") e a digitada à mão é outra ("Corrida").
 *    Entre candidatos, ganha a data mais próxima e depois a descrição mais parecida.
 */
export function findDuplicateEntries(
  entries: ReadonlyArray<StatementEntry>,
  existing: ReadonlyArray<Comparable>,
): Set<number> {
  const used = new Set<number>();
  const duplicates = new Set<number>();

  const byKey = new Map<string, number[]>();
  const byAmount = new Map<string, number[]>();
  existing.forEach((t, j) => {
    const exact = keyOf(t);
    byKey.set(exact, [...(byKey.get(exact) ?? []), j]);
    const loose = `${t.type}|${cents(t.amount)}`;
    byAmount.set(loose, [...(byAmount.get(loose) ?? []), j]);
  });

  entries.forEach((entry, i) => {
    const j = byKey.get(keyOf(entry))?.find((k) => !used.has(k));
    if (j === undefined) return;
    used.add(j);
    duplicates.add(i);
  });

  // Todos os pares possíveis, do mais provável ao menos: assim a linha "GOLD" fica com a "GOLD"
  // cadastrada mesmo que outra linha de mesmo valor venha antes no extrato.
  const pairs: { i: number; j: number; days: number; similarity: number }[] = [];
  entries.forEach((entry, i) => {
    if (duplicates.has(i)) return;
    for (const j of byAmount.get(`${entry.type}|${cents(entry.amount)}`) ?? []) {
      if (used.has(j)) continue;
      const days = daysApart(existing[j].date, entry.date);
      if (days > 1) continue;
      pairs.push({ i, j, days, similarity: descriptionSimilarity(existing[j].description, entry.description) });
    }
  });
  pairs.sort((a, b) => a.days - b.days || b.similarity - a.similarity || a.i - b.i);
  for (const { i, j } of pairs) {
    if (duplicates.has(i) || used.has(j)) continue;
    used.add(j);
    duplicates.add(i);
  }

  return duplicates;
}

/**
 * Índices dos lançamentos da fatura que já existem no crédito desse cartão. A descrição da fatura
 * ("IFOOD *RESTAURANTE") quase nunca bate com a digitada ("Jantar"), então compara tipo e valor,
 * com até 1 dia de diferença na data. Cada transação existente casa com uma linha só.
 */
export function findDuplicateCardEntries(
  entries: ReadonlyArray<Pick<Transaction, 'date' | 'type' | 'amount'>>,
  existing: ReadonlyArray<Transaction>,
  cardId: string,
): Set<number> {
  const pool = existing.filter((t) => t.paymentMethod === 'credit_card' && t.creditCardId === cardId);
  const used = new Set<string>();
  const duplicates = new Set<number>();
  entries.forEach((entry, i) => {
    const cents = Math.round(entry.amount * 100);
    const match = pool.find(
      (t) =>
        !used.has(t.id) &&
        t.type === entry.type &&
        Math.round(t.amount * 100) === cents &&
        daysApart(t.date, entry.date) <= 1,
    );
    if (match) {
      used.add(match.id);
      duplicates.add(i);
    }
  });
  return duplicates;
}
