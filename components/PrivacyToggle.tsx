'use client';

import { Eye, EyeOff } from 'lucide-react';
import { useSyncExternalStore } from 'react';

import { isPrivate, privacyStore, setPrivate } from '@/lib/privacy';

/** Modo privado ligado? No servidor é sempre false (valores só aparecem depois da hidratação). */
export function usePrivacyHidden(): boolean {
  return useSyncExternalStore(privacyStore.subscribe, isPrivate, () => false);
}

/** O "olho" dos apps de banco: mostra/oculta todos os valores do app. */
export function PrivacyToggle({ withLabel = false, className = '' }: { withLabel?: boolean; className?: string }) {
  const hidden = usePrivacyHidden();
  const Icon = hidden ? EyeOff : Eye;
  const label = hidden ? 'Mostrar valores' : 'Ocultar valores';
  return (
    <button
      type="button"
      className={`btn btn-ghost ${withLabel ? 'justify-start gap-3' : 'btn-circle'} ${className}`}
      onClick={() => setPrivate(!hidden)}
      aria-pressed={hidden}
      aria-label={label}
      title={label}
    >
      <Icon className="h-5 w-5" aria-hidden />
      {withLabel && <span>{label}</span>}
    </button>
  );
}
