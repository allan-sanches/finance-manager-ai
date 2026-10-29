'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { BrandMark } from '@/components/BrandMark';
import { LogoutButton } from '@/components/LogoutButton';
import { isActive, NAV } from '@/components/nav';
import { ThemeToggle } from '@/components/ThemeToggle';

export function Sidebar() {
  const pathname = usePathname();
  return (
    <aside className="sticky top-0 hidden h-dvh flex-col gap-6 p-4 md:flex">
      <Link href="/" className="flex items-center gap-3 px-2 pt-2">
        <BrandMark />
        <div className="leading-tight">
          <p className="font-extrabold tracking-tight">Capitalismo</p>
          <p className="eyebrow !text-[10px]">Selvagem</p>
        </div>
      </Link>

      <nav className="panel flex-1 p-3">
        <ul className="flex flex-col gap-1">
          {NAV.map(({ href, label, icon: Icon }) => {
            const active = isActive(pathname, href);
            return (
              <li key={href}>
                <Link
                  href={href}
                  aria-current={active ? 'page' : undefined}
                  className={`flex items-center gap-3 rounded-field px-3 py-2.5 text-sm font-semibold transition ${
                    active
                      ? 'bg-primary text-primary-content shadow-sm'
                      : 'text-base-content/70 hover:bg-base-200 hover:text-base-content'
                  }`}
                >
                  <Icon className="h-5 w-5" aria-hidden />
                  {label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="panel flex flex-col gap-1 p-2">
        <ThemeToggle withLabel className="w-full" />
        <LogoutButton />
      </div>
    </aside>
  );
}
