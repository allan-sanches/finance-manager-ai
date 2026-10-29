'use server';

import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';

import { isAiProviderConfigured } from '@/lib/ai';
import { AI_PROVIDER_COOKIE, AI_PROVIDER_LABEL, isAiProvider } from '@/lib/ai-provider';
import { requireSession } from '@/lib/auth';

export type SaveAiProviderState = { ok: boolean; message: string } | null;

const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

export async function saveAiProvider(
  _prev: SaveAiProviderState,
  formData: FormData,
): Promise<SaveAiProviderState> {
  await requireSession();

  const provider = formData.get('provider');
  if (!isAiProvider(provider)) {
    return { ok: false, message: 'Provedor de IA inválido.' };
  }
  if (!isAiProviderConfigured(provider)) {
    return {
      ok: false,
      message: `${AI_PROVIDER_LABEL[provider]} não tem chave de API configurada no servidor.`,
    };
  }

  const store = await cookies();
  store.set(AI_PROVIDER_COOKIE, provider, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: ONE_YEAR_SECONDS,
  });
  revalidatePath('/configuracoes');

  return { ok: true, message: `Pronto! A IA do app agora usa ${AI_PROVIDER_LABEL[provider]}.` };
}
