import { LoginForm } from '@/components/LoginForm';
import { safeRedirectPath } from '@/lib/session';

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string | string[] }>;
}) {
  const { next } = await searchParams;
  return (
    <main className="bg-base-200 grid min-h-dvh place-items-center px-4">
      <div className="card bg-base-100 w-full max-w-sm shadow-lg">
        <div className="card-body gap-4">
          <div className="flex items-center gap-3">
            <div className="bg-primary text-primary-content grid h-10 w-10 place-items-center rounded-lg font-bold">
              $
            </div>
            <div className="leading-tight">
              <h1 className="text-lg font-semibold">finance-manager-ai</h1>
              <p className="text-base-content/60 text-sm">Entre para ver suas finanças</p>
            </div>
          </div>
          <LoginForm next={safeRedirectPath(Array.isArray(next) ? next[0] : next)} />
        </div>
      </div>
    </main>
  );
}
