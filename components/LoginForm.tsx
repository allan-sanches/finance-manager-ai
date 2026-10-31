'use client';

import { useActionState } from 'react';

import { login, type LoginState } from '@/app/actions/auth';

const initialState: LoginState = { error: null };

export function LoginForm({ next }: { next: string }) {
  const [state, formAction, pending] = useActionState(login, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <input type="hidden" name="next" value={next} />
      {/* Sem required: a conta original entra só com a senha enquanto não cadastrar e-mail no perfil. */}
      <label className="form-control w-full">
        <span className="eyebrow mb-2 block">E-mail</span>
        <input
          type="email"
          name="email"
          placeholder="voce@exemplo.com"
          className="input input-bordered input-lg w-full"
          autoComplete="username"
          inputMode="email"
          autoFocus
        />
      </label>
      <label className="form-control w-full">
        <span className="eyebrow mb-2 block">Senha</span>
        <input
          type="password"
          name="password"
          className="input input-bordered input-lg w-full"
          autoComplete="current-password"
          required
        />
      </label>

      {state.error && (
        <div role="alert" className="alert alert-error py-2 text-sm">
          <span>{state.error}</span>
        </div>
      )}

      <button type="submit" className="btn btn-primary btn-lg" disabled={pending}>
        {pending && <span className="loading loading-spinner loading-sm" />}
        Entrar
      </button>
    </form>
  );
}
