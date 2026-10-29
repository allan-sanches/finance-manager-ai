import { logout } from '@/app/actions/auth';

export function LogoutButton({ className = '' }: { className?: string }) {
  return (
    <form action={logout}>
      <button type="submit" className={`btn btn-ghost btn-sm w-full justify-start ${className}`}>
        Sair
      </button>
    </form>
  );
}
