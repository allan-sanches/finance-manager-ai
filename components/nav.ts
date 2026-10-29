import {
  ArrowLeftRight,
  Download,
  House,
  ListChecks,
  PiggyBank,
  Settings,
  Sparkles,
  type LucideIcon,
} from 'lucide-react';

export type NavItem = { href: string; label: string; icon: LucideIcon };

export const NAV: ReadonlyArray<NavItem> = [
  { href: '/', label: 'Início', icon: House },
  { href: '/transacoes', label: 'Transações', icon: ArrowLeftRight },
  { href: '/caixinhas', label: 'Caixinhas', icon: PiggyBank },
  { href: '/listas', label: 'Listas', icon: ListChecks },
  { href: '/ia-input', label: 'Entrada por IA', icon: Sparkles },
  { href: '/importar', label: 'Importar', icon: Download },
  { href: '/configuracoes', label: 'Configurações', icon: Settings },
];

export const isActive = (pathname: string, href: string) =>
  href === '/' ? pathname === '/' : pathname.startsWith(href);

/** Rótulo da página atual, para o cabeçalho do celular. */
export const pageTitle = (pathname: string) =>
  NAV.find((item) => isActive(pathname, item.href))?.label ?? 'Capitalismo Selvagem';
