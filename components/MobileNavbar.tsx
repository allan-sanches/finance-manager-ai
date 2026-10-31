'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { BrandMark } from '@/components/BrandMark';
import { pageTitle } from '@/components/nav';
import { PrivacyToggle } from '@/components/PrivacyToggle';
import { ThemeToggle } from '@/components/ThemeToggle';

/** Cabeçalho do celular: só marca, título da página e tema. A navegação fica na tab bar. */
export function MobileNavbar() {
  const pathname = usePathname();
  return (
    <header className="bg-base-200/85 sticky top-0 z-30 flex items-center gap-3 px-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-3 backdrop-blur md:hidden">
      <Link href="/" aria-label="Início">
        <BrandMark size={34} />
      </Link>
      <h1 className="flex-1 truncate text-lg font-extrabold tracking-tight">{pageTitle(pathname)}</h1>
      <PrivacyToggle />
      <ThemeToggle />
    </header>
  );
}
