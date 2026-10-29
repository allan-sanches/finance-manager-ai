import { ProfileEmailForm, ProfilePasswordForm } from '@/components/ProfileForms';
import { PageHeader } from '@/components/ui';
import { requireSession } from '@/lib/auth';
import { getDb } from '@/lib/db';
import { getAccount } from '@/lib/db/repository';

export const dynamic = 'force-dynamic';

export default async function PerfilPage() {
  await requireSession();
  const { email, passwordHash } = await getAccount(getDb());

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4">
      <PageHeader title="Perfil" subtitle="Seu e-mail e a senha de acesso ao app." />

      <ProfileEmailForm email={email ?? ''} />

      <ProfilePasswordForm usingInitialPassword={!passwordHash} />
    </div>
  );
}
