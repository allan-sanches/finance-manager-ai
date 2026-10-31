'use client';

import { X } from 'lucide-react';
import Link from 'next/link';

import { CategoryAvatar } from '@/components/CategoryAvatar';
import { BRL } from '@/lib/finance';
import { normalizeCategoryName } from '@/lib/tones';

type Item = { name: string; value: number };

/**
 * Gastos por categoria em chips. Com `hrefFor`, cada chip é um link (dashboard → tela do mês filtrada);
 * com `onSelect`, filtra na própria tela (tocar de novo na escolhida limpa o filtro).
 */
export function CategoryBreakdown({
  items,
  selected = '',
  hrefFor,
  onSelect,
}: {
  items: ReadonlyArray<Item>;
  selected?: string;
  hrefFor?: (name: string) => string;
  onSelect?: (name: string) => void;
}) {
  const isSelected = (name: string) =>
    selected !== '' && normalizeCategoryName(name) === normalizeCategoryName(selected);

  return (
    <ul className="flex flex-wrap gap-2">
      {items.map((c) => {
        const active = isSelected(c.name);
        const className = `flex min-h-11 flex-auto items-center gap-2 rounded-field p-2 text-left transition-colors ${
          active ? 'bg-base-content text-base-100' : 'bg-base-200 hover:bg-base-300'
        }`;
        const body = (
          <>
            <CategoryAvatar category={c.name} size="sm" />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-xs font-semibold opacity-70">{c.name}</span>
              <span className="block font-bold tabular-nums">{BRL.format(c.value)}</span>
            </span>
            {active && <X className="h-4 w-4 shrink-0" aria-hidden />}
          </>
        );
        return (
          <li key={c.name} className="flex flex-auto">
            {hrefFor ? (
              <Link href={hrefFor(c.name)} className={className} aria-label={`Ver gastos de ${c.name}`}>
                {body}
              </Link>
            ) : (
              <button
                type="button"
                className={className}
                aria-pressed={active}
                aria-label={active ? `Tirar o filtro ${c.name}` : `Ver só ${c.name}`}
                onClick={() => onSelect?.(active ? '' : c.name)}
              >
                {body}
              </button>
            )}
          </li>
        );
      })}
    </ul>
  );
}
