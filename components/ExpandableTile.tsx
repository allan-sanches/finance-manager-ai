'use client';

import { ChevronDown, type LucideIcon } from 'lucide-react';
import Link from 'next/link';
import { useId, useState, type ReactNode } from 'react';

import { TONE_CLASS, type Tone } from '@/lib/tones';

/**
 * Tile do dashboard que abre um detalhamento ao toque. Aberto, ocupa a linha inteira no celular
 * (duas colunas) para a lista caber sem espremer.
 */
export function ExpandableTile({
  tone,
  label,
  icon: Icon,
  value,
  hint,
  children,
}: {
  tone: Tone;
  label: string;
  icon?: LucideIcon;
  value: ReactNode;
  hint?: ReactNode;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const detailsId = useId();

  return (
    <article className={`tile flex flex-col p-4 ${TONE_CLASS[tone]} ${open ? 'col-span-2' : ''}`}>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={detailsId}
        onClick={() => setOpen((o) => !o)}
        className="flex min-h-11 w-full cursor-pointer flex-col gap-2 text-left"
      >
        <span className="eyebrow flex w-full items-center gap-1.5 !opacity-90">
          {Icon && <Icon className="h-3.5 w-3.5" aria-hidden />}
          <span className="flex-1">{label}</span>
          <ChevronDown
            className={`h-4 w-4 shrink-0 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
            aria-hidden
          />
        </span>
        <span className="metric text-2xl sm:text-3xl">{value}</span>
        {hint && <span className="text-xs font-medium opacity-80">{hint}</span>}
      </button>

      <div
        id={detailsId}
        inert={!open}
        className={`grid transition-[grid-template-rows] duration-300 ease-out ${
          open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
        }`}
      >
        <div className="overflow-hidden">
          <div className="mt-3 border-t border-current/20 pt-3">{children}</div>
        </div>
      </div>
    </article>
  );
}

export type TileDetailRow = {
  key: string;
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  /** 0–100; mostra uma barra fina abaixo da linha. */
  progress?: number;
};

/** Lista de itens dentro de um ExpandableTile; herda a cor do texto do tile. */
export function TileDetails({
  rows,
  empty,
  footer,
}: {
  rows: ReadonlyArray<TileDetailRow>;
  empty: string;
  footer?: { href: string; label: string };
}) {
  return (
    <div className="flex flex-col gap-3">
      {rows.length === 0 ? (
        <p className="text-sm font-medium opacity-80">{empty}</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {rows.map((r) => (
            <li key={r.key} className="flex flex-col gap-1">
              <div className="flex items-baseline justify-between gap-3">
                <span className="min-w-0 truncate text-sm font-bold">{r.label}</span>
                <span className="shrink-0 text-sm font-extrabold tabular-nums">{r.value}</span>
              </div>
              {r.sub && <p className="truncate text-xs font-medium opacity-75">{r.sub}</p>}
              {r.progress !== undefined && (
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-black/15">
                  <div
                    className="h-full rounded-full bg-current"
                    style={{ width: `${Math.min(100, Math.max(0, r.progress))}%` }}
                  />
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
      {footer && (
        <Link
          href={footer.href}
          className="flex min-h-11 items-center justify-center rounded-field bg-black/10 text-sm font-bold"
        >
          {footer.label}
        </Link>
      )}
    </div>
  );
}
