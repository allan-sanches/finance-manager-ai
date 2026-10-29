import { cookies } from 'next/headers';

import { AiProviderSettingsForm } from '@/components/AiProviderSettingsForm';
import { getAiProviderStatuses, resolveAiProvider } from '@/lib/ai';
import { AI_PROVIDER_COOKIE } from '@/lib/ai-provider';
import { requireSession } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export default async function ConfiguracoesPage() {
  await requireSession();
  const store = await cookies();
  const current = resolveAiProvider(store.get(AI_PROVIDER_COOKIE)?.value);

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold md:text-3xl">Configurações</h1>
        <p className="text-base-content/60 text-sm">
          Escolha qual inteligência artificial interpreta as frases da Entrada por IA e lê os PDFs importados. As chaves de
          API ficam somente no servidor (arquivo .env.local).
        </p>
      </header>

      <AiProviderSettingsForm current={current} statuses={getAiProviderStatuses()} />
    </div>
  );
}
