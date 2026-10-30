'use client';

import { X } from 'lucide-react';
import { useEffect, useState, type FormEvent } from 'react';

import { DebtImportReview } from '@/components/DebtImportReview';
import { StatementImportReview } from '@/components/StatementImportReview';
import { shrinkImage } from '@/lib/shrinkImage';
import type { ImportPreview } from '@/types/finance';

type ImportKind = 'statement' | 'scr' | 'serasa';

const KINDS: { id: ImportKind; label: string; accept: string; hint: string; multiple?: boolean }[] =
  [
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
      accept: 'image/*,.pdf',
      multiple: true,
      hint: 'Prints da tela de dívidas do app (pode mandar vários de uma vez) ou o PDF. Substitui as dívidas do Serasa salvas antes.',
    },
  ];

type ApiResponse = { ok: true; data: ImportPreview } | { ok: false; error: string };

export function ImportPanel() {
  const [kind, setKind] = useState<ImportKind>('statement');
  const [files, setFiles] = useState<File[]>([]);
  const [inputKey, setInputKey] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [done, setDone] = useState<string | null>(null);

  const current = KINDS.find((k) => k.id === kind)!;

  // Miniaturas dos prints escolhidos (URLs liberadas ao trocar a seleção).
  const [thumbs, setThumbs] = useState<string[]>([]);
  useEffect(() => {
    const urls = files
      .filter((f) => f.type.startsWith('image/'))
      .map((f) => URL.createObjectURL(f));
    setThumbs(urls);
    return () => urls.forEach((u) => URL.revokeObjectURL(u));
  }, [files]);

  function reset() {
    setFiles([]);
    setInputKey((k) => k + 1);
    setPreview(null);
    setError(null);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (files.length === 0 || loading) return;
    setLoading(true);
    setError(null);
    setPreview(null);
    setDone(null);

    try {
      const body = new FormData();
      body.set('kind', kind);
      for (const f of await Promise.all(files.map(shrinkImage))) body.append('file', f);
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
      <div
        role="tablist"
        className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 md:mx-0 md:px-0"
      >
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
            multiple={current.multiple}
            onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
            disabled={loading}
          />
          {thumbs.length > 0 && (
            <ul className="no-scrollbar flex gap-2 overflow-x-auto">
              {thumbs.map((src, i) => (
                <li key={src} className="relative shrink-0">
                  {/* eslint-disable-next-line @next/next/no-img-element -- blob local, sem otimização */}
                  <img
                    src={src}
                    alt={`Print ${i + 1}`}
                    className="rounded-field h-28 w-auto border border-base-300 object-cover"
                  />
                  <button
                    type="button"
                    className="btn btn-circle btn-xs absolute -top-2 -right-2"
                    aria-label={`Remover print ${i + 1}`}
                    onClick={() =>
                      setFiles((prev) =>
                        prev.filter((f) => f.type.startsWith('image/')).filter((_, j) => j !== i),
                      )
                    }
                    disabled={loading}
                  >
                    <X className="h-3 w-3" aria-hidden />
                  </button>
                </li>
              ))}
            </ul>
          )}
          <div className="card-actions items-center justify-between">
            <span className="text-base-content/60 text-xs">{current.hint}</span>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={files.length === 0 || loading}
            >
              {loading ? (
                <>
                  <span className="loading loading-spinner loading-sm" />
                  {files.length > 1 ? `Lendo ${files.length} arquivos…` : 'Lendo arquivo…'}
                </>
              ) : files.length > 1 ? (
                `Ler ${files.length} arquivos`
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
