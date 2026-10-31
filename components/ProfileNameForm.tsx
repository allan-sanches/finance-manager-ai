'use client';

import { useState, type FormEvent } from 'react';

import { greeting } from '@/lib/greeting';
import { useFinanceStore } from '@/lib/store';
import { useHydrated } from '@/lib/useHydratedStore';

const MAX_NAME = 40;

/** Nome usado nas saudações do app ("Bom dia, Allan"). Fica nas preferências da conta. */
export function ProfileNameForm() {
  const hydrated = useHydrated();
  const saved = useFinanceStore((s) => s.settings.displayName ?? '');
  const updateSettings = useFinanceStore((s) => s.updateSettings);
  // null = ainda não mexeu: mostra o salvo (que chega depois da hidratação).
  const [draft, setDraft] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const value = draft ?? saved;
  const name = value.trim();

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    updateSettings({ displayName: name });
    setDraft(null);
    setMessage(name ? `Pronto! Agora o app te chama de ${name}.` : 'Nome removido das saudações.');
  }

  return (
    <form onSubmit={handleSubmit} className="panel">
      <div className="card-body gap-4">
        <h2 className="card-title">Seu nome</h2>
        <label className="form-control w-full">
          <span className="eyebrow mb-2 block">Como quer ser chamado</span>
          <input
            name="displayName"
            value={value}
            onChange={(e) => {
              setDraft(e.target.value);
              setMessage(null);
            }}
            placeholder="Ex: Allan"
            className="input input-bordered input-lg w-full"
            autoComplete="given-name"
            maxLength={MAX_NAME}
            disabled={!hydrated}
          />
          <span className="text-base-content/60 mt-1 block text-xs">
            Aparece nas saudações da página inicial: “{greeting(name)}!”
          </span>
        </label>

        {message && (
          <div role="status" className="alert alert-success">
            <span>{message}</span>
          </div>
        )}

        <div className="card-actions justify-end">
          <button type="submit" className="btn btn-primary" disabled={!hydrated || name === saved.trim()}>
            Salvar nome
          </button>
        </div>
      </div>
    </form>
  );
}
