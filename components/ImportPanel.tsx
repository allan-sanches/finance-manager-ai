'use client';

import { useState, type FormEvent } from 'react';

import { DebtImportReview } from '@/components/DebtImportReview';
import { StatementImportReview } from '@/components/StatementImportReview';
import type { ImportPreview } from '@/types/finance';

type ImportKind = 'statement' | 'scr' | 'serasa';

const KINDS: { id: ImportKind; label: string; accept: string; hint: string }[] = [
  {
    id: 'statement',
    label: 'Extrato bancário',
    accept: '.ofx,.csv,.pdf,.txt',
    hint: 'OFX ou CSV são lidos sem IA. PDF é lido pela IA.',
  },
  {
    id: 'scr',
    label: 'Registrato (SCR)',
    accept: '.pdf',
    hint: 'PDF do Relatório de Empréstimos e Financiamentos. A soma é conferida com o total do relatório.',
  },
  {
    id: 'serasa',
    label: 'Serasa',
    accept: '.pdf',
    hint: 'PDF com as dívidas pendentes / negativações.',
  },
];

type ApiResponse = { ok: true; data: ImportPreview } | { ok: false; error: string };

export function ImportPanel() {
  const [kind, setKind] = useState<ImportKind>('statement');
  const [file, setFile] = useState<File | null>(null);
  const [inputKey, setInputKey] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [done, setDone] = useState<string | null>(null);

  const current = KINDS.find((k) => k.id === kind)!;

  function reset() {
    setFile(null);
    setInputKey((k) => k + 1);
    setPreview(null);
    setError(null);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!file || loading) return;
    setLoading(true);
    setError(null);
    setPreview(null);
    setDone(null);

    try {
      const body = new FormData();
      body.set('kind', kind);
      body.set('file', file);
      const response = await fetch('/api/import', { method: 'POST', body });
      const payload = (await response.json().catch(() => ({
        ok: false,
        error: `Erro inesperado do servidor (${response.status}).`,
      }))) as ApiResponse;
      if (payload.ok) setPreview(payload.data);
      else setError(payload.error);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha de rede.');
    } finally {
      setLoading(false);
    }
  }

  function handleDone(message: string) {
    reset();
    setDone(message);
  }

  return (
    <div className="flex flex-col gap-4">
      <div role="tablist" className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 md:mx-0 md:px-0">
        {KINDS.map((k) => (
          <button
            key={k.id}
            role="tab"
            type="button"
            aria-selected={kind === k.id}
            className={`btn btn-sm shrink-0 rounded-full ${kind === k.id ? 'btn-neutral' : 'btn-ghost bg-base-100'}`}
            onClick={() => {
              setKind(k.id);
              setDone(null);
              reset();
            }}
            disabled={loading}
          >
            {k.label}
          </button>
        ))}
      </div>

      <form onSubmit={handleSubmit} className="panel">
        <div className="card-body gap-3">
          <label htmlFor="import-file" className="label">
            <span className="label-text font-medium">Arquivo</span>
          </label>
          <input
            key={inputKey}
            id="import-file"
            type="file"
            accept={current.accept}
            className="file-input file-input-bordered w-full"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            disabled={loading}
          />
          <div className="card-actions items-center justify-between">
            <span className="text-base-content/60 text-xs">{current.hint} Máximo 5 MB.</span>
            <button type="submit" className="btn btn-primary" disabled={!file || loading}>
              {loading ? (
                <>
                  <span className="loading loading-spinner loading-sm" />
                  Lendo arquivo…
                </>
              ) : (
                'Ler arquivo'
              )}
            </button>
          </div>
        </div>
      </form>

      {error && (
        <div role="alert" className="alert alert-error">
          <span>{error}</span>
        </div>
      )}

      {done && (
        <div role="status" className="alert alert-success">
          <span>{done}</span>
        </div>
      )}

      {preview?.kind === 'statement' && (
        <StatementImportReview preview={preview} onCancel={reset} onDone={handleDone} />
      )}
      {preview?.kind === 'debts' && (
        <DebtImportReview preview={preview} onCancel={reset} onDone={handleDone} />
      )}
    </div>
  );
}
