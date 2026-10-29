import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

import { categoryStyle, TONE_CLASS, type Tone } from '@/lib/tones';

/** Cabeçalho das páginas. No celular o título já está no topo (MobileNavbar), então só a linha de apoio aparece. */
export function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <header className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        <h1 className="hidden text-3xl font-extrabold tracking-tight md:block">{title}</h1>
        {subtitle && <p className="text-base-content/60 text-sm md:mt-1">{subtitle}</p>}
      </div>
      {action}
    </header>
  );
}

/** Bloco colorido com rótulo, número grande e linha de apoio. */
export function Tile({
  tone,
  label,
  icon: Icon,
  value,
  hint,
  className = '',
  children,
}: {
  tone: Tone;
  label: string;
  icon?: LucideIcon;
  value?: ReactNode;
  hint?: ReactNode;
  className?: string;
  children?: ReactNode;
}) {
  return (
    <article className={`tile flex flex-col gap-2 p-4 ${TONE_CLASS[tone]} ${className}`}>
      <div className="eyebrow flex items-center gap-1.5 !opacity-90">
        {Icon && <Icon className="h-3.5 w-3.5" aria-hidden />}
        {label}
      </div>
      {value !== undefined && <div className="metric text-2xl sm:text-3xl">{value}</div>}
      {hint && <div className="text-xs font-medium opacity-80">{hint}</div>}
      {children}
    </article>
  );
}

/** Título de seção dentro de um panel. */
export function SectionTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-3 flex items-center justify-between gap-2">
      <h2 className="eyebrow">{children}</h2>
      {action}
    </div>
  );
}

/** Quadradinho colorido com o emoji da categoria. */
export function CategoryAvatar({ category, size = 'md' }: { category: string; size?: 'sm' | 'md' }) {
  const { emoji, tone } = categoryStyle(category);
  const box = size === 'sm' ? 'h-9 w-9 text-lg' : 'h-11 w-11 text-xl';
  return (
    <span aria-hidden className={`grid shrink-0 place-items-center rounded-xl ${box} ${TONE_CLASS[tone]}`}>
      {emoji}
    </span>
  );
}

export function EmptyState({
  emoji,
  title,
  children,
}: {
  emoji: string;
  title: string;
  children?: ReactNode;
}) {
  return (
    <div className="panel flex flex-col items-center gap-2 px-6 py-10 text-center">
      <span className="text-4xl" aria-hidden>
        {emoji}
      </span>
      <p className="font-bold">{title}</p>
      {children && <div className="text-base-content/60 text-sm">{children}</div>}
    </div>
  );
}
