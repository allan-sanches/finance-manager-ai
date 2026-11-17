import { redirect } from 'next/navigation';

import { BrandMark } from '@/components/BrandMark';
import { LoginForm } from '@/components/LoginForm';
import { getSessionUserId } from '@/lib/auth';
import { safeRedirectPath } from '@/lib/session';

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string | string[] }>;
}) {
  const { next } = await searchParams;
  const safeNext = safeRedirectPath(Array.isArray(next) ? next[0] : next);
  if (await getSessionUserId()) redirect(safeNext);
  return (
    <main className="grid min-h-dvh place-items-center px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="tile mb-4 flex flex-col gap-3 bg-lime-300 p-6 text-neutral-900">
          <BrandMark size={48} />
          <div>
            <p className="eyebrow">Finanças pessoais</p>
            <h1 className="mt-1 text-3xl leading-none font-extrabold tracking-tight">
              Capitalismo
              <br />
              Selvagem
            </h1>
          </div>
        </div>
        <div className="panel p-6">
          <LoginForm next={safeNext} />
        </div>
      </div>
    </main>
  );
}
