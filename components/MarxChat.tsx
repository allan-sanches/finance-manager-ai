'use client';

import { Check, Paperclip, RotateCcw, SendHorizontal, Trash2, X } from 'lucide-react';
import {
  Fragment,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type FormEvent,
  type KeyboardEvent,
} from 'react';

import { CategoryAvatar } from '@/components/CategoryAvatar';
import { DebtImportReview } from '@/components/DebtImportReview';
import { fireMarxLaser, MarxAvatar } from '@/components/MarxAvatar';
import { usePrivacyHidden } from '@/components/PrivacyToggle';
import { StatementImportReview } from '@/components/StatementImportReview';
import { BRL, DEBT_SOURCE_LABEL, PAYMENT_METHOD_LABEL, shortDate } from '@/lib/finance';
import { findDuplicateEntries } from '@/lib/import/dedupe';
import { DEFAULT_MARX_MODEL, isMarxModel, MARX_MODELS, marxModelLabel, type MarxModelId } from '@/lib/marx/models';
import { MARX_MAX_MESSAGE_LENGTH, type MarxGoalMove, type MarxReply } from '@/lib/marx/schemas';
import { shrinkImage } from '@/lib/shrinkImage';
import { useFinanceStore } from '@/lib/store';
import type { ImportPreview, Transaction, TransactionDraft } from '@/types/finance';

type ProposalStatus = 'pending' | 'added' | 'discarded';
type DocumentStatus = 'pending' | 'done' | 'discarded';

type ChatItem = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  proposals?: TransactionDraft[];
  /** Índices das propostas que já existem no app: chegam desmarcadas. */
  duplicates?: number[];
  proposalStatus?: ProposalStatus;
  addedCount?: number;
  /** "1,4s · ChatGPT 4.1 mini": para comparar a velocidade dos modelos. */
  meta?: string;
  /** Guardar/tirar dinheiro de caixinha, à espera da confirmação. */
  goalMoves?: MarxGoalMove[];
  goalMoveStatus?: 'pending' | 'done' | 'discarded';
  /** Arquivos que o usuário anexou (guardados para "Tentar de novo"). */
  files?: File[];
  /** Prévia do documento lido por /api/import, revisada dentro da conversa. */
  document?: ImportPreview;
  documentStatus?: DocumentStatus;
  documentResult?: string;
};

type ApiResponse = { ok: true; data: MarxReply; model: string } | { ok: false; error: string };
type ImportApiResponse = { ok: true; data: ImportPreview } | { ok: false; error: string };

// Mesmo limite da rota de importação: vários arquivos só se forem prints.
const MAX_ATTACHED_IMAGES = 8;
const ATTACH_ACCEPT = '.pdf,.ofx,.csv,.txt,image/*';

// Modelo escolhido no chat, guardado no aparelho. No servidor e na hidratação vale o padrão.
const MODEL_STORAGE_KEY = 'marx-model';
const modelListeners = new Set<() => void>();

function readSavedModel(): MarxModelId {
  try {
    const saved = localStorage.getItem(MODEL_STORAGE_KEY);
    return isMarxModel(saved) ? saved : DEFAULT_MARX_MODEL;
  } catch {
    return DEFAULT_MARX_MODEL;
  }
}

function saveModel(model: MarxModelId) {
  try {
    localStorage.setItem(MODEL_STORAGE_KEY, model);
  } catch {
    // localStorage indisponível: a escolha não persiste.
  }
  modelListeners.forEach((notify) => notify());
}

function useMarxModel(): MarxModelId {
  return useSyncExternalStore(
    (notify) => {
      modelListeners.add(notify);
      return () => modelListeners.delete(notify);
    },
    readSavedModel,
    () => DEFAULT_MARX_MODEL,
  );
}

const SUGGESTIONS = [
  'Analise meus gastos deste mês',
  'Quanto falta para minhas caixinhas?',
  'Qual desejo cabe no meu orçamento?',
  'Como estão o dólar e o CDI hoje?',
  'Gastei 32 no mercado no débito e 18 de uber no pix',
];

const newId = () => (typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : String(Math.random()));

/** Botão flutuante "Fale com o Marx" + a conversa em tela cheia no celular. */
export function MarxChat() {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<ChatItem[]>([]);
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(false);
  const [readingFile, setReadingFile] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const model = useMarxModel();

  useEffect(() => {
    const dlg = dialogRef.current;
    if (!dlg) return;
    if (open && !dlg.open) dlg.showModal();
    if (!open && dlg.open) dlg.close();
  }, [open]);

  // Rola para a última mensagem quando chega resposta (ou ao abrir).
  useEffect(() => {
    if (open) listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' });
  }, [items, loading, open]);

  async function send(text: string, history: ChatItem[] = items) {
    const content = text.trim();
    if (!content || loading) return;
    const next: ChatItem[] = [...history, { id: newId(), role: 'user', content }];
    setItems(next);
    setDraft('');
    setError(null);
    setLoading(true);
    const startedAt = performance.now();
    try {
      const response = await fetch('/api/marx', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        // O resultado da revisão de um documento ("12 lançamento(s) importado(s).") vai junto, para o Marx saber.
        body: JSON.stringify({
          model,
          messages: next.map(({ role, content: c, documentResult }) => ({
            role,
            content: documentResult ? `${c}

${documentResult}` : c,
          })),
        }),
      });
      const payload = (await response.json().catch(() => ({
        ok: false,
        error: `Erro inesperado do servidor (${response.status}).`,
      }))) as ApiResponse;
      if (!payload.ok) {
        setError(payload.error);
        return;
      }
      const { reply, transactions, goalMoves = [], duplicates = [] } = payload.data;
      const seconds = ((performance.now() - startedAt) / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 });
      setItems((current) => [
        ...current,
        {
          id: newId(),
          role: 'assistant',
          content: reply,
          meta: `${seconds}s · ${marxModelLabel(payload.model)}`,
          ...(transactions.length ? { proposals: transactions, duplicates, proposalStatus: 'pending' as const } : {}),
          ...(goalMoves.length ? { goalMoves, goalMoveStatus: 'pending' as const } : {}),
        },
      ]);
      if (transactions.some((tx, i) => tx.type === 'expense' && !duplicates.includes(i))) fireMarxLaser();
    } catch {
      setError('Sem conexão com o servidor. Confere a internet e tenta de novo.');
    } finally {
      setLoading(false);
    }
  }

  /**
   * Documento anexado: a mesma leitura da tela de importação (/api/import), com o tipo reconhecido
   * no servidor — extrato (PDF, OFX, CSV), Registrato ou Serasa (PDF ou prints).
   */
  async function sendFiles(files: File[], history: ChatItem[] = items) {
    if (files.length === 0 || loading) return;
    const allImages = files.every((f) => f.type.startsWith('image/'));
    if (files.length > 1 && !allImages) {
      setError('Para mandar vários arquivos de uma vez, envie só prints (imagens). PDF vai um por vez.');
      return;
    }
    if (files.length > MAX_ATTACHED_IMAGES) {
      setError(`Envie no máximo ${MAX_ATTACHED_IMAGES} prints por vez.`);
      return;
    }
    const label = files.length > 1 ? `${files.length} prints` : files[0].name;
    setItems([...history, { id: newId(), role: 'user', content: `📎 ${label}`, files }]);
    setError(null);
    setLoading(true);
    setReadingFile(true);
    try {
      const body = new FormData();
      body.set('kind', 'auto');
      for (const f of await Promise.all(files.map(shrinkImage))) body.append('file', f);
      const response = await fetch('/api/import', { method: 'POST', body });
      const payload = (await response.json().catch(() => ({
        ok: false,
        error: `Erro inesperado do servidor (${response.status}).`,
      }))) as ImportApiResponse;
      if (!payload.ok) {
        setError(payload.error);
        return;
      }
      setItems((current) => [
        ...current,
        {
          id: newId(),
          role: 'assistant',
          content: describeDocument(payload.data, useFinanceStore.getState().transactions),
          document: payload.data,
          documentStatus: 'pending',
        },
      ]);
    } catch {
      setError('Sem conexão com o servidor. Confere a internet e tenta de novo.');
    } finally {
      setLoading(false);
      setReadingFile(false);
    }
  }

  /** Tenta de novo a última pergunta (ou o último arquivo) que ficou sem resposta. */
  function retry() {
    const last = items.at(-1);
    if (last?.role !== 'user') return;
    if (last.files) void sendFiles(last.files, items.slice(0, -1));
    else void send(last.content, items.slice(0, -1));
  }

  function settleDocument(id: string, status: DocumentStatus, result?: string) {
    setItems((current) =>
      current.map((i) => (i.id === id ? { ...i, documentStatus: status, documentResult: result } : i)),
    );
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void send(draft);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    // Enter envia; Shift+Enter quebra linha (para colar/escrever uma lista de gastos).
    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      void send(draft);
    }
  }

  function settleProposals(id: string, status: ProposalStatus, addedCount?: number) {
    setItems((current) => current.map((i) => (i.id === id ? { ...i, proposalStatus: status, addedCount } : i)));
  }

  return (
    <>
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="fixed right-4 bottom-[calc(5.25rem+env(safe-area-inset-bottom))] z-40 flex h-14 items-center gap-2 rounded-full border-2 border-black bg-violet-500 pr-5 font-bold text-white shadow-[3px_3px_0_0_#000] transition active:translate-x-[2px] active:translate-y-[2px] active:shadow-[1px_1px_0_0_#000] md:right-8 md:bottom-8"
        >
          {/* O rosto é maior que a pílula e "salta" para fora dela. */}
          <MarxAvatar size={76} className="-my-4 -ml-3" />
          Fale com o Marx
        </button>
      )}

      <dialog
        ref={dialogRef}
        className="modal modal-bottom md:modal-middle"
        aria-labelledby="marx-title"
        onClose={() => setOpen(false)}
      >
        <div className="modal-box flex h-[92dvh] max-h-none flex-col gap-0 p-0 md:h-[85vh] md:max-w-2xl">
          <header className="border-base-content/10 flex items-center gap-3 border-b px-4 py-3">
            <MarxAvatar size={64} />
            <div className="min-w-0 flex-1 leading-tight">
              <h2 id="marx-title" className="font-extrabold">
                Marx
              </h2>
              <p className="text-base-content/60 truncate text-xs">Crítico da economia política — e do seu orçamento</p>
              <label className="mt-1 flex items-center gap-1 text-xs">
                <span className="sr-only">Modelo de IA do Marx</span>
                <select
                  className="select select-xs w-auto max-w-full"
                  value={model}
                  disabled={loading}
                  onChange={(e) => isMarxModel(e.target.value) && saveModel(e.target.value)}
                >
                  {MARX_MODELS.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.label} — {m.hint}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            {items.length > 0 && (
              <button
                type="button"
                className="btn btn-ghost btn-square"
                aria-label="Começar outra conversa"
                title="Começar outra conversa"
                disabled={loading}
                onClick={() => {
                  setItems([]);
                  setError(null);
                }}
              >
                <Trash2 className="h-5 w-5" aria-hidden />
              </button>
            )}
            <button type="button" className="btn btn-ghost btn-square" aria-label="Fechar" onClick={() => setOpen(false)}>
              <X className="h-5 w-5" aria-hidden />
            </button>
          </header>

          <div ref={listRef} className="scroll-thin flex-1 overflow-y-auto px-4 py-4" aria-live="polite">
            {items.length === 0 ? (
              <Welcome onPick={(s) => void send(s)} disabled={loading} />
            ) : (
              <ul className="flex flex-col gap-3">
                {items.map((item) => (
                  <li key={item.id} className="flex flex-col gap-2">
                    <Bubble role={item.role} content={item.content} />
                    {item.meta && <p className="text-base-content/40 -mt-1 pl-2 text-[11px]">{item.meta}</p>}
                    {item.proposals && (
                      <ProposalReview
                        proposals={item.proposals}
                        duplicates={item.duplicates ?? []}
                        status={item.proposalStatus ?? 'pending'}
                        addedCount={item.addedCount}
                        onSettle={(status, count) => settleProposals(item.id, status, count)}
                      />
                    )}
                    {item.goalMoves && (
                      <GoalMoveReview
                        moves={item.goalMoves}
                        status={item.goalMoveStatus ?? 'pending'}
                        onSettle={(status) =>
                          setItems((current) =>
                            current.map((i) => (i.id === item.id ? { ...i, goalMoveStatus: status } : i)),
                          )
                        }
                      />
                    )}
                    {item.document && (
                      <DocumentReview
                        preview={item.document}
                        status={item.documentStatus ?? 'pending'}
                        result={item.documentResult}
                        onSettle={(status, result) => settleDocument(item.id, status, result)}
                      />
                    )}
                  </li>
                ))}
                {loading && (
                  <li
                    className="flex items-center gap-2"
                    aria-label={readingFile ? 'Marx está lendo o documento' : 'Marx está escrevendo'}
                  >
                    <span className="bg-base-200 flex items-center gap-2 rounded-2xl rounded-bl-md px-4 py-3">
                      <span className="loading loading-dots loading-sm" />
                      {readingFile && (
                        <span className="text-base-content/70 text-sm">
                          Lendo o documento… um PDF pode levar até um minuto.
                        </span>
                      )}
                    </span>
                  </li>
                )}
              </ul>
            )}
            {error && (
              <div role="alert" className="alert alert-error mt-3">
                <span>{error}</span>
                {items.at(-1)?.role === 'user' && (
                  <button type="button" className="btn btn-sm" onClick={retry} disabled={loading}>
                    <RotateCcw className="h-4 w-4" aria-hidden />
                    Tentar de novo
                  </button>
                )}
              </div>
            )}
          </div>

          <form
            onSubmit={handleSubmit}
            className="border-base-content/10 flex items-end gap-2 border-t px-3 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]"
          >
            <input
              ref={fileInputRef}
              type="file"
              accept={ATTACH_ACCEPT}
              multiple
              className="hidden"
              onChange={(e) => {
                const picked = Array.from(e.target.files ?? []);
                e.target.value = ''; // permite mandar o mesmo arquivo de novo
                void sendFiles(picked);
              }}
            />
            <button
              type="button"
              className="btn btn-ghost btn-square h-12 w-12"
              aria-label="Anexar documento"
              title="Anexar extrato, Registrato ou Serasa (PDF, OFX, CSV ou prints)"
              disabled={loading}
              onClick={() => fileInputRef.current?.click()}
            >
              <Paperclip className="h-5 w-5" aria-hidden />
            </button>
            <label htmlFor="marx-input" className="sr-only">
              Mensagem para o Marx
            </label>
            <textarea
              id="marx-input"
              rows={1}
              className="textarea textarea-bordered field-sizing-content max-h-32 min-h-12 flex-1 resize-none text-base"
              placeholder="Pergunte ou conte seus gastos…"
              value={draft}
              maxLength={MARX_MAX_MESSAGE_LENGTH}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={loading}
            />
            <button
              type="submit"
              className="btn btn-primary btn-square h-12 w-12"
              aria-label="Enviar"
              disabled={loading || !draft.trim()}
            >
              <SendHorizontal className="h-5 w-5" aria-hidden />
            </button>
          </form>
        </div>
        <form method="dialog" className="modal-backdrop">
          <button aria-label="Fechar">fechar</button>
        </form>
      </dialog>
    </>
  );
}

function Welcome({ onPick, disabled }: { onPick: (text: string) => void; disabled: boolean }) {
  return (
    <div className="flex flex-col gap-4">
      <Bubble
        role="assistant"
        content={
          'Saudações. Sou Karl Marx. Tenho diante de mim seus gastos, suas reservas, seus desejos e suas dívidas — e também o câmbio e os juros que o capital cobra de você.\n\n' +
          'Pergunte o que quiser, ou relate vários gastos de uma vez: eu os registro para que você confira antes de lançar.\n\n' +
          'Pelo clipe, mande também documentos: o extrato do banco (PDF, OFX ou CSV), o Registrato ou o Serasa (PDF ou prints).'
        }
      />
      <div className="flex flex-wrap gap-2">
        {SUGGESTIONS.map((s) => (
          <button
            key={s}
            type="button"
            className="btn btn-sm btn-outline h-auto min-h-10 rounded-full py-2 text-left font-medium normal-case"
            onClick={() => onPick(s)}
            disabled={disabled}
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  );
}

function Bubble({ role, content }: { role: 'user' | 'assistant'; content: string }) {
  const mine = role === 'user';
  return (
    <div className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
      <p
        className={`max-w-[85%] rounded-2xl px-4 py-2.5 leading-relaxed break-words whitespace-pre-wrap ${
          mine ? 'bg-primary text-primary-content rounded-br-md' : 'bg-base-200 rounded-bl-md'
        }`}
      >
        <InlineMarkdown text={content} />
      </p>
    </div>
  );
}

/** Só o **negrito** que o Marx usa para destacar valores; o resto é texto puro (sem HTML). */
function InlineMarkdown({ text }: { text: string }) {
  return (
    <>
      {text.split('**').map((part, i) => (
        <Fragment key={i}>{i % 2 === 1 ? <strong>{part}</strong> : part}</Fragment>
      ))}
    </>
  );
}

const plural = (n: number, one: string, many: string) => (n === 1 ? `1 ${one}` : `${n} ${many}`);

function describeDocument(preview: ImportPreview, existing: ReadonlyArray<Transaction>): string {
  const n = preview.entries.length;
  if (preview.kind === 'statement') {
    if (n === 0) return 'Li o extrato, mas não encontrei lançamentos nele. Confira se é o arquivo certo.';
    // Mesma conta que a revisão faz ao abrir: o resumo e os itens desmarcados batem.
    const repeated = findDuplicateEntries(preview.entries, existing).size;
    const fresh = n - repeated;
    const movedCount = preview.entries.filter((e) => e.isTransfer).length;
    const moved =
      movedCount > 0
        ? ` ${movedCount === 1 ? '1 é movimentação' : `${movedCount} são movimentações`} (investimento, fatura ou entre suas contas) e fica${movedCount === 1 ? '' : 'm'} fora de entradas e saídas.`
        : '';
    if (repeated === 0) {
      return `Li o extrato: **${plural(n, 'lançamento', 'lançamentos')}**, nenhum ainda no app.${moved} Confira abaixo, ajuste o que precisar e importe.`;
    }
    if (fresh === 0) {
      return `Li o extrato: ${n === 1 ? 'esse lançamento já está' : `os ${n} lançamentos já estão`} no app. Não há nada novo para importar.`;
    }
    return `Li o extrato: ${plural(n, 'lançamento', 'lançamentos')}, dos quais **${plural(repeated, 'já está', 'já estão')} no app** e ${repeated === 1 ? 'veio desmarcado' : 'vieram desmarcados'}. Sobram **${plural(fresh, 'novo', 'novos')}** para conferir abaixo.${moved}`;
  }
  const source = DEBT_SOURCE_LABEL[preview.source];
  if (n === 0) return `Li o relatório do ${source}, mas não encontrei dívidas nele.`;
  return `Li o relatório do ${source}: **${n === 1 ? '1 dívida' : `${n} dívidas`}**. Confira abaixo antes de salvar.`;
}

/** Revisão do documento dentro da conversa: as mesmas telas da importação. */
function DocumentReview({
  preview,
  status,
  result,
  onSettle,
}: {
  preview: ImportPreview;
  status: DocumentStatus;
  result?: string;
  onSettle: (status: DocumentStatus, result?: string) => void;
}) {
  if (status === 'done') {
    return (
      <p className="text-success flex items-center gap-1 text-sm font-semibold">
        <Check className="h-4 w-4" aria-hidden />
        {result}
      </p>
    );
  }
  if (status === 'discarded') {
    return <p className="text-base-content/50 text-sm">Importação cancelada.</p>;
  }
  if (preview.entries.length === 0) return null;
  const handlers = {
    embedded: true,
    onCancel: () => onSettle('discarded'),
    onDone: (message: string) => onSettle('done', message),
  };
  return preview.kind === 'statement' ? (
    <StatementImportReview preview={preview} {...handlers} />
  ) : (
    <DebtImportReview preview={preview} {...handlers} />
  );
}

/** Guardar/tirar de caixinha proposto pelo Marx: os mesmos botões da tela Caixinhas, com confirmação. */
function GoalMoveReview({
  moves,
  status,
  onSettle,
}: {
  moves: MarxGoalMove[];
  status: 'pending' | 'done' | 'discarded';
  onSettle: (status: 'done' | 'discarded') => void;
}) {
  const goals = useFinanceStore((s) => s.savingsGoals);
  const depositToGoal = useFinanceStore((s) => s.depositToGoal);
  const withdrawFromGoal = useFinanceStore((s) => s.withdrawFromGoal);
  usePrivacyHidden();

  const rows = moves
    .map((m) => ({ ...m, goal: goals.find((g) => g.id === m.goalId) }))
    .filter((m): m is typeof m & { goal: NonNullable<typeof m.goal> } => Boolean(m.goal));
  if (rows.length === 0) return null;

  const format = (value: number, currency: 'BRL' | 'USD') =>
    currency === 'USD' ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'USD' }).format(value) : BRL.format(value);

  if (status === 'done') {
    return (
      <p className="text-success flex items-center gap-1 text-sm font-semibold">
        <Check className="h-4 w-4" aria-hidden />
        Caixinha atualizada
      </p>
    );
  }
  if (status === 'discarded') return <p className="text-base-content/50 text-sm">Movimento de caixinha descartado.</p>;

  return (
    <div className="panel border-2 border-violet-500/40 p-3">
      <p className="eyebrow mb-2">Confira antes de mexer na caixinha</p>
      <ul className="flex flex-col gap-2">
        {rows.map((m, i) => {
          const amount = m.action === 'withdraw' ? Math.min(m.amount, m.goal.currentAmount) : m.amount;
          return (
            <li key={i} className="flex min-h-11 items-center justify-between gap-3">
              <span className="min-w-0">
                <span className="block font-semibold">
                  {m.action === 'withdraw' ? 'Tirar da' : 'Guardar na'} caixinha {m.goal.name}
                </span>
                <span className="text-base-content/60 block text-xs">
                  Saldo: {format(m.goal.currentAmount, m.goal.currency)} →{' '}
                  {format(m.goal.currentAmount + (m.action === 'withdraw' ? -amount : amount), m.goal.currency)}
                </span>
              </span>
              <span className={`shrink-0 font-bold ${m.action === 'withdraw' ? 'text-error' : 'text-success'}`}>
                {m.action === 'withdraw' ? '−' : '+'}
                {format(amount, m.goal.currency)}
              </span>
            </li>
          );
        })}
      </ul>
      <div className="mt-3 flex gap-2">
        <button type="button" className="btn btn-ghost flex-1" onClick={() => onSettle('discarded')}>
          Descartar
        </button>
        <button
          type="button"
          className="btn btn-primary flex-[2]"
          onClick={() => {
            for (const m of rows) {
              if (m.action === 'withdraw') withdrawFromGoal(m.goalId, Math.min(m.amount, m.goal.currentAmount));
              else depositToGoal(m.goalId, m.amount);
            }
            onSettle('done');
          }}
        >
          <Check className="h-5 w-5" aria-hidden />
          Confirmar
        </button>
      </div>
    </div>
  );
}

function ProposalReview({
  proposals,
  duplicates,
  status,
  addedCount,
  onSettle,
}: {
  proposals: TransactionDraft[];
  duplicates: number[];
  status: ProposalStatus;
  addedCount?: number;
  onSettle: (status: ProposalStatus, addedCount?: number) => void;
}) {
  const importTransactions = useFinanceStore((s) => s.importTransactions);
  const creditCards = useFinanceStore((s) => s.creditCards);
  const bankAccounts = useFinanceStore((s) => s.bankAccounts);
  // Os valores são formatados na renderização: assinar o olho redesenha ao ligar/desligar.
  usePrivacyHidden();
  const [selected, setSelected] = useState<ReadonlySet<number>>(
    () => new Set(proposals.map((_, i) => i).filter((i) => !duplicates.includes(i))),
  );

  if (status === 'added') {
    return (
      <p className="text-success flex items-center gap-1 text-sm font-semibold">
        <Check className="h-4 w-4" aria-hidden />
        {addedCount === 1 ? '1 lançamento salvo' : `${addedCount} lançamentos salvos`}
      </p>
    );
  }
  if (status === 'discarded') {
    return <p className="text-base-content/50 text-sm">Lançamentos descartados.</p>;
  }

  const chosen = proposals.filter((_, i) => selected.has(i));
  const total = chosen.reduce((sum, tx) => sum + (tx.type === 'expense' ? -tx.amount : tx.amount), 0);

  function toggle(index: number) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  }

  return (
    <div className="panel border-violet-500/40 border-2 p-3">
      <p className="eyebrow mb-2">Confira antes de lançar</p>
      <ul className="flex flex-col gap-1">
        {proposals.map((tx, i) => {
          const where = tx.creditCardId
            ? creditCards.find((c) => c.id === tx.creditCardId)?.name
            : tx.bankAccountId
              ? bankAccounts.find((a) => a.id === tx.bankAccountId)?.name
              : undefined;
          return (
            <li key={i}>
              <label className="hover:bg-base-200 flex min-h-14 cursor-pointer items-center gap-3 rounded-field px-1 py-1.5">
                <input
                  type="checkbox"
                  className="checkbox checkbox-primary"
                  checked={selected.has(i)}
                  onChange={() => toggle(i)}
                />
                <CategoryAvatar category={tx.category} size="sm" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold">{tx.description}</span>
                  <span className="text-base-content/60 block truncate text-xs">
                    {tx.category} · {PAYMENT_METHOD_LABEL[tx.paymentMethod]}
                    {where ? ` · ${where}` : ''} · {shortDate(tx.date)}
                    {tx.isPaid === false ? ' · a pagar' : ''}
                  </span>
                  {duplicates.includes(i) && <span className="badge badge-info badge-sm mt-1">já está no app</span>}
                </span>
                <span className={`shrink-0 font-bold ${tx.type === 'expense' ? 'text-error' : 'text-success'}`}>
                  {tx.type === 'expense' ? '−' : '+'}
                  {BRL.format(tx.amount)}
                </span>
              </label>
            </li>
          );
        })}
      </ul>
      {proposals.length > 1 && (
        <p className="text-base-content/70 mt-2 text-right text-sm">
          Total selecionado: <strong>{BRL.format(total)}</strong>
        </p>
      )}
      <div className="mt-3 flex gap-2">
        <button type="button" className="btn btn-ghost flex-1" onClick={() => onSettle('discarded')}>
          Descartar
        </button>
        <button
          type="button"
          className="btn btn-primary flex-[2]"
          disabled={chosen.length === 0}
          onClick={() => {
            importTransactions(chosen);
            onSettle('added', chosen.length);
          }}
        >
          <Check className="h-5 w-5" aria-hidden />
          {chosen.length === 1 ? 'Lançar 1' : `Lançar ${chosen.length}`}
        </button>
      </div>
    </div>
  );
}
