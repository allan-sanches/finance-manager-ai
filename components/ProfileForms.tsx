'use client';

import { useActionState, useEffect, useRef, useState } from 'react';

import {
  changePassword,
  createUser,
  resetUserPassword,
  saveEmail,
  type ProfileFormState,
} from '@/app/perfil/actions';
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
            required
          />
          <span className="text-base-content/60 mt-1 block text-xs">É com ele que você entra no app.</span>
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

/** Só aparece para o admin. Cada conta tem os próprios lançamentos, cartões, caixinhas e listas. */
export function ProfileUsersPanel({ users }: { users: { id: string; email: string }[] }) {
  return (
    <section className="panel">
      <div className="card-body gap-4">
        <h2 className="card-title">Outras pessoas</h2>
        <p className="text-base-content/70 text-sm">
          Cada conta vê só os próprios dados. A pessoa entra com o e-mail e a senha inicial e troca a
          senha no perfil dela.
        </p>

        {users.length > 0 && (
          <ul className="flex flex-col gap-2">
            {users.map((user) => (
              <UserRow key={user.id} user={user} />
            ))}
          </ul>
        )}

        <CreateUserForm />
      </div>
    </section>
  );
}

function UserRow({ user }: { user: { id: string; email: string } }) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState<ProfileFormState, FormData>(resetUserPassword, null);
  const formRef = useRef<HTMLFormElement>(null);

  // A senha nova não fica na tela depois de salva; a mensagem de sucesso continua visível.
  useEffect(() => {
    if (state?.ok) formRef.current?.reset();
  }, [state]);

  return (
    <li className="bg-base-200 rounded-box flex flex-col gap-3 px-4 py-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm font-medium break-all">{user.email}</span>
        <button
          type="button"
          className="btn btn-ghost btn-sm min-h-11"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
        >
          {open ? 'Cancelar' : 'Redefinir senha'}
        </button>
      </div>

      {open && (
        <form ref={formRef} action={formAction} className="flex flex-col gap-3">
          <input type="hidden" name="userId" value={user.id} />
          <PasswordField
            name="password"
            label="Nova senha"
            autoComplete="new-password"
            hint={`Mínimo de ${MIN_PASSWORD_LENGTH} caracteres. A senha antiga deixa de funcionar.`}
            minLength={MIN_PASSWORD_LENGTH}
          />
          <FormFeedback state={state} />
          <div className="flex justify-end">
            <SubmitButton pending={pending} label="Salvar nova senha" />
          </div>
        </form>
      )}
    </li>
  );
}

function CreateUserForm() {
  const [state, formAction, pending] = useActionState<ProfileFormState, FormData>(createUser, null);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state?.ok) formRef.current?.reset();
  }, [state]);

  return (
    <form ref={formRef} action={formAction} className="flex flex-col gap-4">
      <h3 className="font-semibold">Nova conta</h3>
      <label className="form-control w-full">
        <span className="eyebrow mb-2 block">E-mail da pessoa</span>
        <input
          type="email"
          name="email"
          placeholder="pessoa@exemplo.com"
          className="input input-bordered input-lg w-full"
          autoComplete="off"
          inputMode="email"
          required
        />
      </label>
      <PasswordField
        name="password"
        label="Senha inicial"
        autoComplete="new-password"
        hint={`Mínimo de ${MIN_PASSWORD_LENGTH} caracteres. Passe para a pessoa por um canal seguro.`}
        minLength={MIN_PASSWORD_LENGTH}
      />

      <FormFeedback state={state} />

      <div className="card-actions justify-end">
        <SubmitButton pending={pending} label="Criar conta" />
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
