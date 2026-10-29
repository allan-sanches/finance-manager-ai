import { cookies } from 'next/headers';

import { AiProviderSettingsForm } from '@/components/AiProviderSettingsForm';
import { CategorySettings } from '@/components/CategorySettings';
import { PageHeader } from '@/components/ui';
import { getAiProviderStatuses, resolveAiProvider } from '@/lib/ai';
import { AI_PROVIDER_COOKIE } from '@/lib/ai-provider';
import { requireSession } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export default async function ConfiguracoesPage() {
  await requireSession();
  const store = await cookies();
  const current = resolveAiProvider(store.get(AI_PROVIDER_COOKIE)?.value);

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4">
      <PageHeader title="Configurações" subtitle="Suas categorias e qual IA lê frases e PDFs." />

      <CategorySettings />

      <AiProviderSettingsForm current={current} statuses={getAiProviderStatuses()} />
    </div>
  );
}
