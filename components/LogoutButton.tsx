import { LogOut } from 'lucide-react';

import { logout } from '@/app/actions/auth';

export function LogoutButton({ className = '' }: { className?: string }) {
  return (
    <form action={logout}>
      <button
        type="submit"
        className={`btn btn-ghost text-base-content/70 w-full justify-start gap-3 font-medium ${className}`}
      >
        <LogOut className="h-5 w-5" aria-hidden />
        Sair
      </button>
    </form>
  );
}
