import type { ReactNode } from 'react';

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

/** Título de seção dentro de um panel. */
export function SectionTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-3 flex items-center justify-between gap-2">
      <h2 className="eyebrow">{children}</h2>
      {action}
    </div>
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
