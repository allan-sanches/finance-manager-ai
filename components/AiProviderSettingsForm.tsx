'use client';

import { useActionState } from 'react';

import { saveAiProvider, type SaveAiProviderState } from '@/app/configuracoes/actions';
import { AI_PROVIDER_LABEL, type AiProvider, type AiProviderStatus } from '@/lib/ai-provider';

const DESCRIPTION: Record<AiProvider, string> = {
  gateway:
    'Uma chave para vários modelos (padrão: GPT-5 mini), com saída validada por schema e troca automática de provedor se um cair.',
  gemini: 'Saída JSON validada por schema direto na API do Google.',
  deepseek: 'Modo JSON da API do DeepSeek, validado pela aplicação antes de chegar à tela.',
};

const ENV_KEY: Record<AiProvider, string> = {
  gateway: 'AI_GATEWAY_API_KEY',
  gemini: 'GEMINI_API_KEY',
  deepseek: 'DEEPSEEK_API_KEY',
};

export function AiProviderSettingsForm({
  current,
  statuses,
}: {
  current: AiProvider;
  statuses: ReadonlyArray<AiProviderStatus>;
}) {
  const [state, formAction, pending] = useActionState<SaveAiProviderState, FormData>(
    saveAiProvider,
    null,
  );

  return (
    <form action={formAction} className="panel">
      <div className="card-body gap-4">
        <fieldset className="flex flex-col gap-3">
          <legend className="card-title mb-3">Provedor de IA</legend>
          {statuses.map(({ provider, configured, model }) => (
            <label
              key={provider}
              className={`border-base-300 flex items-start gap-3 rounded-box border p-4 ${
                configured ? 'hover:border-primary cursor-pointer' : 'cursor-not-allowed opacity-60'
              }`}
            >
              <input
                type="radio"
                name="provider"
                value={provider}
                defaultChecked={provider === current}
                disabled={!configured || pending}
                className="radio radio-primary mt-1"
              />
              <span className="flex flex-1 flex-col gap-1">
                <span className="flex flex-wrap items-center gap-2 font-semibold">
                  {AI_PROVIDER_LABEL[provider]}
                  {provider === current && <span className="badge badge-primary">Em uso</span>}
                  {configured ? (
                    <span className="badge badge-success badge-outline">Chave configurada</span>
                  ) : (
                    <span className="badge badge-warning badge-outline">Sem chave</span>
                  )}
                </span>
                <span className="text-base-content/70 text-sm">{DESCRIPTION[provider]}</span>
                <span className="text-base-content/60 text-xs">
                  Modelo: <code>{model}</code>
                  {!configured && (
                    <>
                      {' '}
                      — defina <code>{ENV_KEY[provider]}</code> no .env.local e reinicie o servidor.
                    </>
                  )}
                </span>
              </span>
            </label>
          ))}
        </fieldset>

        {state && (
          <div role="status" className={`alert ${state.ok ? 'alert-success' : 'alert-error'}`}>
            <span>{state.message}</span>
          </div>
        )}

        <div className="card-actions justify-end">
          <button type="submit" className="btn btn-primary" disabled={pending}>
            {pending ? (
              <>
                <span className="loading loading-spinner loading-sm" />
                Salvando…
              </>
            ) : (
              'Salvar'
            )}
          </button>
        </div>
      </div>
    </form>
  );
}
