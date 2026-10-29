'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { LogoutButton } from '@/components/LogoutButton';

type NavItem = {
  href: string;
  label: string;
  icon: string;
};

const NAV: ReadonlyArray<NavItem> = [
  { href: '/', label: 'Dashboard', icon: 'M3 12 12 4l9 8M5 10v10h14V10' },
  { href: '/ia-input', label: 'Entrada por IA', icon: 'M12 3v18M3 12h18' },
  { href: '/transacoes', label: 'Transações', icon: 'M4 6h16M4 12h16M4 18h10' },
  { href: '/importar', label: 'Importar', icon: 'M12 4v11M7 10l5 5 5-5M4 20h16' },
  { href: '/listas', label: 'Listas', icon: 'M5 5h14v4H5zM5 11h14v4H5zM5 17h14v4H5z' },
  { href: '/caixinhas', label: 'Caixinhas', icon: 'M4 7h16v13H4zM9 3h6v4H9z' },
  {
    href: '/configuracoes',
    label: 'Configurações',
    icon: 'M4 6h16M4 12h16M4 18h16M9 4v4M15 10v4M7 16v4',
  },
];

export function Sidebar() {
  const pathname = usePathname();
  return (
    <aside className="bg-base-200 border-base-300 hidden border-r md:flex md:flex-col">
      <div className="border-base-300 flex items-center gap-3 border-b px-5 py-4">
        <div className="bg-primary text-primary-content grid h-9 w-9 place-items-center rounded-lg font-bold">
          $
        </div>
        <div className="leading-tight">
          <p className="text-base-content font-semibold">finance-manager-ai</p>
          <p className="text-base-content/60 text-xs">Capitalismo Selvagem</p>
        </div>
      </div>

      <nav className="flex-1 p-3">
        <ul className="menu menu-md w-full gap-1">
          {NAV.map((item) => {
            const active = item.href === '/' ? pathname === '/' : pathname.startsWith(item.href);
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={active ? 'page' : undefined}
                  className={active ? 'menu-active font-semibold' : ''}
                >
                  <svg
                    aria-hidden
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={1.8}
                    className="h-5 w-5"
                  >
                    <path d={item.icon} strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="border-base-300 flex flex-col gap-1 border-t p-3 text-xs">
        <ThemeToggle />
        <LogoutButton className="text-base-content/70 px-3 font-normal" />
      </div>
    </aside>
  );
}

function ThemeToggle() {
  return (
    <label className="swap swap-rotate hover:bg-base-300 flex w-full cursor-pointer items-center justify-between rounded-md px-3 py-2">
      <span className="text-base-content/70 text-sm">Tema</span>
      <input
        type="checkbox"
        className="theme-controller"
        value="dark"
        aria-label="Alternar tema claro / escuro"
      />
      <svg
        className="swap-off h-5 w-5 fill-current"
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
      >
        <path d="M5.64 17l-.71.71a1 1 0 0 0 1.41 1.41l.71-.71A1 1 0 0 0 5.64 17zM5 12a1 1 0 0 0-1-1H3a1 1 0 0 0 0 2h1a1 1 0 0 0 1-1zm7-7a1 1 0 0 0 1-1V3a1 1 0 0 0-2 0v1a1 1 0 0 0 1 1zM5.64 7.05a1 1 0 0 0 .7.29 1 1 0 0 0 .71-.29 1 1 0 0 0 0-1.41l-.71-.71a1 1 0 0 0-1.41 1.41zM17 5.64a1 1 0 0 0 .7-.29l.71-.71a1 1 0 1 0-1.41-1.41l-.71.71A1 1 0 0 0 17 5.64zM21 11h-1a1 1 0 0 0 0 2h1a1 1 0 0 0 0-2zm-9 8a1 1 0 0 0-1 1v1a1 1 0 0 0 2 0v-1a1 1 0 0 0-1-1zm6.36-2a1 1 0 0 0-1.41 1.41l.71.71a1 1 0 0 0 1.41 0 1 1 0 0 0 0-1.41zM12 6.5a5.5 5.5 0 1 0 5.5 5.5A5.51 5.51 0 0 0 12 6.5z" />
      </svg>
      <svg
        className="swap-on h-5 w-5 fill-current"
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
      >
        <path d="M21.64 13a1 1 0 0 0-1.05-.14 8.05 8.05 0 0 1-3.37.73 8.15 8.15 0 0 1-8.14-8.1 8.59 8.59 0 0 1 .25-2A1 1 0 0 0 8 2.36a10.14 10.14 0 1 0 14 11.69 1 1 0 0 0-.36-1.05z" />
      </svg>
    </label>
  );
}
