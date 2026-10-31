'use client';

import {
  ArrowLeftRight,
  CreditCard,
  Download,
  House,
  Landmark,
  ListChecks,
  Menu,
  PenLine,
  PiggyBank,
  Plus,
  Settings,
  Sparkles,
  UserRound,
  type LucideIcon,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useRef, useState } from 'react';

import { LogoutButton } from '@/components/LogoutButton';
import { isActive } from '@/components/nav';
import { ThemeToggle } from '@/components/ThemeToggle';
import { TransactionFormDialog } from '@/components/TransactionFormDialog';

const TABS: { href: string; label: string; icon: LucideIcon }[] = [
  { href: '/', label: 'Início', icon: House },
  { href: '/transacoes', label: 'Transações', icon: ArrowLeftRight },
];
const TABS_RIGHT: { href: string; label: string; icon: LucideIcon }[] = [
  { href: '/caixinhas', label: 'Caixinhas', icon: PiggyBank },
];
const MORE: { href: string; label: string; icon: LucideIcon }[] = [
  { href: '/cartoes', label: 'Cartões', icon: CreditCard },
  { href: '/dividas', label: 'Dívidas', icon: Landmark },
  { href: '/listas', label: 'Listas', icon: ListChecks },
  { href: '/importar', label: 'Importar arquivos', icon: Download },
  { href: '/ia-input', label: 'Entrada por IA', icon: Sparkles },
  { href: '/perfil', label: 'Perfil', icon: UserRound },
  { href: '/configuracoes', label: 'Configurações', icon: Settings },
];

/** Tab bar fixa no rodapé do celular, com o "+" central para lançar rápido. */
export function BottomTabBar() {
  const pathname = usePathname();
  const router = useRouter();
  const addRef = useRef<HTMLDialogElement>(null);
  const moreRef = useRef<HTMLDialogElement>(null);
  const [txOpen, setTxOpen] = useState(false);
  const moreActive = MORE.some((m) => isActive(pathname, m.href));

  function go(href: string, dialog: HTMLDialogElement | null) {
    dialog?.close();
    router.push(href);
  }

  return (
    <>
      <nav
        aria-label="Navegação principal"
        className="bg-base-100/95 fixed inset-x-0 bottom-0 z-40 border-t border-base-content/10 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
      >
        <ul className="mx-auto grid h-16 max-w-md grid-cols-5 items-center">
          {TABS.map((t) => (
            <Tab key={t.href} {...t} active={isActive(pathname, t.href)} />
          ))}
          <li className="grid place-items-center">
            <button
              type="button"
              aria-label="Adicionar"
              className="bg-primary text-primary-content grid h-14 w-14 -translate-y-4 place-items-center rounded-2xl border-2 border-black shadow-[3px_3px_0_0_#000] transition active:translate-y-[-14px] active:shadow-[1px_1px_0_0_#000]"
              onClick={() => addRef.current?.showModal()}
            >
              <Plus className="h-7 w-7" strokeWidth={3} aria-hidden />
            </button>
          </li>
          {TABS_RIGHT.map((t) => (
            <Tab key={t.href} {...t} active={isActive(pathname, t.href)} />
          ))}
          <li>
            <button
              type="button"
              className={`flex h-16 w-full flex-col items-center justify-center gap-1 text-[11px] font-semibold ${
                moreActive ? 'text-primary' : 'text-base-content/60'
              }`}
              onClick={() => moreRef.current?.showModal()}
            >
              <Menu className="h-6 w-6" aria-hidden />
              Mais
            </button>
          </li>
        </ul>
      </nav>

      <dialog ref={addRef} className="modal modal-bottom">
        <div className="modal-box pb-[max(1.5rem,env(safe-area-inset-bottom))]">
          <p className="eyebrow mb-3">Adicionar</p>
          <div className="grid gap-2">
            <SheetAction
              icon={PenLine}
              tone="bg-lime-300 text-neutral-900"
              title="Novo lançamento"
              subtitle="Preencher gasto ou receita"
              onClick={() => {
                addRef.current?.close();
                setTxOpen(true);
              }}
            />
            <SheetAction
              icon={Sparkles}
              tone="bg-violet-500 text-white"
              title="Falar com a IA"
              subtitle='"Gastei 45 no iFood ontem no crédito"'
              onClick={() => go('/ia-input', addRef.current)}
            />
            <SheetAction
              icon={Download}
              tone="bg-cyan-300 text-neutral-900"
              title="Importar arquivo"
              subtitle="Extrato, Registrato ou Serasa"
              onClick={() => go('/importar', addRef.current)}
            />
          </div>
        </div>
        <form method="dialog" className="modal-backdrop">
          <button aria-label="Fechar">fechar</button>
        </form>
      </dialog>

      <dialog ref={moreRef} className="modal modal-bottom">
        <div className="modal-box pb-[max(1.5rem,env(safe-area-inset-bottom))]">
          <p className="eyebrow mb-3">Mais</p>
          <ul className="grid gap-1">
            {MORE.map(({ href, label, icon: Icon }) => (
              <li key={href}>
                <Link
                  href={href}
                  onClick={() => moreRef.current?.close()}
                  className={`flex min-h-12 items-center gap-3 rounded-field px-3 font-semibold ${
                    isActive(pathname, href) ? 'bg-primary text-primary-content' : 'hover:bg-base-200'
                  }`}
                >
                  <Icon className="h-5 w-5" aria-hidden />
                  {label}
                </Link>
              </li>
            ))}
          </ul>
          <div className="border-base-content/10 mt-3 grid gap-1 border-t pt-3">
            <ThemeToggle withLabel className="w-full" />
            <LogoutButton />
          </div>
        </div>
        <form method="dialog" className="modal-backdrop">
          <button aria-label="Fechar">fechar</button>
        </form>
      </dialog>

      <TransactionFormDialog open={txOpen} onClose={() => setTxOpen(false)} />
    </>
  );
}

function Tab({ href, label, icon: Icon, active }: { href: string; label: string; icon: LucideIcon; active: boolean }) {
  return (
    <li>
      <Link
        href={href}
        aria-current={active ? 'page' : undefined}
        className={`flex h-16 flex-col items-center justify-center gap-1 text-[11px] font-semibold ${
          active ? 'text-primary' : 'text-base-content/60'
        }`}
      >
        <Icon className="h-6 w-6" strokeWidth={active ? 2.5 : 2} aria-hidden />
        {label}
      </Link>
    </li>
  );
}

function SheetAction({
  icon: Icon,
  tone,
  title,
  subtitle,
  onClick,
}: {
  icon: LucideIcon;
  tone: string;
  title: string;
  subtitle: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="hover:bg-base-200 flex min-h-16 items-center gap-3 rounded-field p-2 text-left"
    >
      <span className={`grid h-12 w-12 shrink-0 place-items-center rounded-xl ${tone}`}>
        <Icon className="h-6 w-6" aria-hidden />
      </span>
      <span className="min-w-0">
        <span className="block font-bold">{title}</span>
        <span className="text-base-content/60 block truncate text-sm">{subtitle}</span>
      </span>
    </button>
  );
}
