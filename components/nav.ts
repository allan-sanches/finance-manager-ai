import {
  ArrowLeftRight,
  CreditCard,
  Download,
  Gift,
  House,
  Landmark,
  ListChecks,
  PiggyBank,
  Settings,
  Sparkles,
  UserRound,
  type LucideIcon,
} from 'lucide-react';

export type NavItem = { href: string; label: string; icon: LucideIcon };

export const NAV: ReadonlyArray<NavItem> = [
  { href: '/', label: 'Início', icon: House },
  { href: '/transacoes', label: 'Transações', icon: ArrowLeftRight },
  { href: '/cartoes', label: 'Cartões', icon: CreditCard },
  { href: '/dividas', label: 'Dívidas', icon: Landmark },
  { href: '/caixinhas', label: 'Caixinhas', icon: PiggyBank },
  { href: '/listas', label: 'Lista de compras', icon: ListChecks },
  { href: '/desejos', label: 'Lista de desejos', icon: Gift },
  { href: '/ia-input', label: 'Entrada por IA', icon: Sparkles },
  { href: '/importar', label: 'Importar', icon: Download },
  { href: '/perfil', label: 'Perfil', icon: UserRound },
  { href: '/configuracoes', label: 'Configurações', icon: Settings },
];

export const isActive = (pathname: string, href: string) =>
  href === '/' ? pathname === '/' : pathname.startsWith(href);

/** Rótulo da página atual, para o cabeçalho do celular. */
export const pageTitle = (pathname: string) =>
  NAV.find((item) => isActive(pathname, item.href))?.label ?? 'Capitalismo Selvagem';
