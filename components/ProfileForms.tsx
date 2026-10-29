'use client';

import { useActionState, useEffect, useRef } from 'react';

import { changePassword, saveEmail, type ProfileFormState } from '@/app/perfil/actions';
import { MIN_PASSWORD_LENGTH } from '@/lib/password-rules';

export function ProfileEmailForm({ email }: { email: string }) {
  const [state, formAction, pending] = useActionState<ProfileFormState, FormData>(saveEmail, null);

  return (
    <form action={formAction} className="panel">
      <div className="card-body gap-4">
        <h2 className="card-title">E-mail</h2>
        <label className="form-control w-full">
          <span className="eyebrow mb-2 block">Seu e-mail</span>
          <input
            type="email"
            name="email"
            defaultValue={email}
            placeholder="voce@exemplo.com"
            className="input input-bordered input-lg w-full"
            autoComplete="email"
            inputMode="email"
          />
        </label>

        <FormFeedback state={state} />

        <div className="card-actions justify-end">
          <SubmitButton pending={pending} label="Salvar e-mail" />
        </div>
      </div>
    </form>
  );
}

export function ProfilePasswordForm({ usingInitialPassword }: { usingInitialPassword: boolean }) {
  const [state, formAction, pending] = useActionState<ProfileFormState, FormData>(changePassword, null);
  const formRef = useRef<HTMLFormElement>(null);

  // Não deixar senhas preenchidas na tela depois de trocar.
  useEffect(() => {
    if (state?.ok) formRef.current?.reset();
  }, [state]);

  return (
    <form ref={formRef} action={formAction} className="panel">
      <div className="card-body gap-4">
        <h2 className="card-title">Trocar senha</h2>
        {usingInitialPassword && (
          <p className="text-base-content/70 text-sm">
            Você ainda usa a senha inicial definida no servidor. Depois de trocar aqui, só a nova senha
            funciona.
          </p>
        )}

        <PasswordField name="currentPassword" label="Senha atual" autoComplete="current-password" />
        <PasswordField
          name="newPassword"
          label="Nova senha"
          autoComplete="new-password"
          hint={`Mínimo de ${MIN_PASSWORD_LENGTH} caracteres.`}
          minLength={MIN_PASSWORD_LENGTH}
        />
        <PasswordField
          name="confirmPassword"
          label="Confirmar nova senha"
          autoComplete="new-password"
          minLength={MIN_PASSWORD_LENGTH}
        />

        <FormFeedback state={state} />

        <div className="card-actions justify-end">
          <SubmitButton pending={pending} label="Trocar senha" />
        </div>
      </div>
    </form>
  );
}

function PasswordField({
  name,
  label,
  autoComplete,
  hint,
  minLength,
}: {
  name: string;
  label: string;
  autoComplete: string;
  hint?: string;
  minLength?: number;
}) {
  return (
    <label className="form-control w-full">
      <span className="eyebrow mb-2 block">{label}</span>
      <input
        type="password"
        name={name}
        className="input input-bordered input-lg w-full"
        autoComplete={autoComplete}
        minLength={minLength}
        required
      />
      {hint && <span className="text-base-content/60 mt-1 block text-xs">{hint}</span>}
    </label>
  );
}

function FormFeedback({ state }: { state: ProfileFormState }) {
  if (!state) return null;
  return (
    <div role="status" className={`alert py-2 text-sm ${state.ok ? 'alert-success' : 'alert-error'}`}>
      <span>{state.message}</span>
    </div>
  );
}

function SubmitButton({ pending, label }: { pending: boolean; label: string }) {
  return (
    <button type="submit" className="btn btn-primary min-h-12" disabled={pending}>
      {pending && <span className="loading loading-spinner loading-sm" />}
      {pending ? 'Salvando…' : label}
    </button>
  );
}
