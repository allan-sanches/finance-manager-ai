'use client';

import { Monitor, Moon, Sun } from 'lucide-react';
import { useEffect, useState } from 'react';

import { THEME_BY_MODE, THEME_STORAGE_KEY } from '@/lib/theme';

type Mode = 'system' | 'light' | 'dark';

const NEXT: Record<Mode, Mode> = { system: 'light', light: 'dark', dark: 'system' };
const LABEL: Record<Mode, string> = { system: 'Sistema', light: 'Claro', dark: 'Escuro' };
const ICON = { system: Monitor, light: Sun, dark: Moon };

function readMode(): Mode {
  try {
    const saved = localStorage.getItem(THEME_STORAGE_KEY);
    return saved === 'light' || saved === 'dark' ? saved : 'system';
  } catch {
    return 'system';
  }
}

function applyMode(mode: Mode) {
  const root = document.documentElement;
  if (mode === 'system') root.removeAttribute('data-theme');
  else root.setAttribute('data-theme', THEME_BY_MODE[mode]);
  try {
    if (mode === 'system') localStorage.removeItem(THEME_STORAGE_KEY);
    else localStorage.setItem(THEME_STORAGE_KEY, mode);
  } catch {
    // localStorage indisponível: o tema vale só para esta aba.
  }
}

export function ThemeToggle({ withLabel = false, className = '' }: { withLabel?: boolean; className?: string }) {
  const [mode, setMode] = useState<Mode>('system');
  useEffect(() => setMode(readMode()), []);

  const Icon = ICON[mode];
  return (
    <button
      type="button"
      className={`btn btn-ghost ${withLabel ? 'justify-start gap-3' : 'btn-circle'} ${className}`}
      onClick={() => {
        const next = NEXT[mode];
        applyMode(next);
        setMode(next);
      }}
      aria-label={`Tema: ${LABEL[mode]}. Tocar para trocar.`}
      title={`Tema: ${LABEL[mode]}`}
    >
      <Icon className="h-5 w-5" aria-hidden />
      {withLabel && <span>Tema: {LABEL[mode]}</span>}
    </button>
  );
}
