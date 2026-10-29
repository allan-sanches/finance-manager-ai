'use client';

import type { ReactNode } from 'react';

/**
 * Barra de confirmação presa ao rodapé: no celular a revisão pode ter dezenas de linhas, e o botão
 * de importar precisa estar ao alcance do polegar sem rolar até o fim.
 */
export function ImportActionBar({
  summary,
  confirmLabel,
  confirmDisabled,
  onCancel,
  onConfirm,
}: {
  summary: ReactNode;
  confirmLabel: string;
  confirmDisabled?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="bg-base-100/95 border-base-300 sticky bottom-0 z-20 -mx-4 border-t px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur md:mx-0 md:rounded-box md:border">
      <p className="text-base-content/70 mb-2 text-center text-sm md:text-left">{summary}</p>
      <div className="flex gap-2 md:justify-end">
        <button type="button" className="btn btn-ghost flex-1 md:flex-none" onClick={onCancel}>
          Cancelar
        </button>
        <button
          type="button"
          className="btn btn-primary flex-[2] md:flex-none"
          disabled={confirmDisabled}
          onClick={onConfirm}
        >
          {confirmLabel}
        </button>
      </div>
    </div>
  );
}
