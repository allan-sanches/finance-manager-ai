'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { LogoutButton } from '@/components/LogoutButton';

const ITEMS = [
  { href: '/', label: 'Dashboard' },
  { href: '/ia-input', label: 'IA' },
  { href: '/transacoes', label: 'Transações' },
  { href: '/importar', label: 'Importar' },
  { href: '/listas', label: 'Listas' },
  { href: '/caixinhas', label: 'Caixinhas' },
  { href: '/configuracoes', label: 'Configurações' },
];

export function MobileNavbar() {
  const pathname = usePathname();
  return (
    <div className="navbar bg-base-200 border-base-300 sticky top-0 z-30 border-b md:hidden">
      <div className="flex-1">
        <Link href="/" className="btn btn-ghost text-lg font-semibold">
          finance-manager-ai
        </Link>
      </div>
      <div className="dropdown dropdown-end">
        <button
          type="button"
          tabIndex={0}
          className="btn btn-ghost btn-circle"
          aria-label="Abrir menu"
        >
          <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor">
            <path strokeWidth={2} strokeLinecap="round" d="M4 7h16M4 12h16M4 17h16" />
          </svg>
        </button>
        <ul
          tabIndex={0}
          className="menu dropdown-content bg-base-200 rounded-box z-40 mt-3 w-52 p-2 shadow"
        >
          {ITEMS.map((item) => {
            const active = item.href === '/' ? pathname === '/' : pathname.startsWith(item.href);
            return (
              <li key={item.href}>
                <Link href={item.href} className={active ? 'menu-active' : ''}>
                  {item.label}
                </Link>
              </li>
            );
          })}
          <li className="border-base-300 mt-1 border-t pt-1">
            <LogoutButton />
          </li>
        </ul>
      </div>
    </div>
  );
}
