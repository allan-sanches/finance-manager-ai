import { ProfileEmailForm, ProfilePasswordForm, ProfileUsersPanel } from '@/components/ProfileForms';
import { PageHeader } from '@/components/ui';
import { requireUserId } from '@/lib/auth';
import { getDb } from '@/lib/db';
import { OWNER_ID, getUser, listUsers } from '@/lib/db/repository';

export const dynamic = 'force-dynamic';

export default async function PerfilPage() {
  const userId = await requireUserId();
  const db = getDb();
  const user = await getUser(db, userId);
  const others = user?.isAdmin ? (await listUsers(db)).filter((u) => u.id !== userId) : null;

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4">
      <PageHeader title="Perfil" subtitle="Seu e-mail de acesso e a senha do app." />

      <ProfileEmailForm email={user?.email ?? ''} />

      <ProfilePasswordForm usingInitialPassword={userId === OWNER_ID && !user?.passwordHash} />

      {others && (
        <ProfileUsersPanel users={others.map((u) => ({ id: u.id, email: u.email ?? '(sem e-mail)' }))} />
      )}
    </div>
  );
}
