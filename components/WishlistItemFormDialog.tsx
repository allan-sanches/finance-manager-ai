'use client';

import { Camera, Gift, Link2, Search, Trash2 } from 'lucide-react';
import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react';

import { lookupProduct } from '@/app/actions/finance';
import { MoneyInput } from '@/components/MoneyInput';
import { todayISO } from '@/lib/finance';
import { parseMoneyInput, toMoneyInput } from '@/lib/money-mask';
import { imageThumbnail } from '@/lib/shrinkImage';
import { useFinanceStore } from '@/lib/store';
import { useOpenedWith } from '@/lib/useMounted';
import { withPrice } from '@/lib/wishlist';
import type { ShoppingItem } from '@/types/finance';

type Priority = NonNullable<ShoppingItem['priority']>;

type Props = {
  open: boolean;
  onClose: () => void;
  initial?: ShoppingItem;
};

const PRIORITIES: { value: Priority; label: string }[] = [
  { value: 'low', label: 'Baixa' },
  { value: 'medium', label: 'Média' },
  { value: 'high', label: 'Alta' },
];

/** Aceita só https (o mesmo que o servidor valida). Vazio = sem valor; inválido = undefined. */
function parseHttpUrl(raw: string, protocols: string[]): string | null | undefined {
  const value = raw.trim();
  if (!value) return null;
  try {
    const url = new URL(value);
    return protocols.includes(url.protocol) ? url.href : undefined;
  } catch {
    return undefined;
  }
}

export function WishlistItemFormDialog({ open, onClose, initial }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const addShoppingItem = useFinanceStore((s) => s.addShoppingItem);
  const updateShoppingItem = useFinanceStore((s) => s.updateShoppingItem);

  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [priority, setPriority] = useState<Priority>('medium');
  const [productUrl, setProductUrl] = useState('');
  // Foto enviada do aparelho (data URL) ou link colado; só um dos dois vale.
  const [photo, setPhoto] = useState<string | null>(null);
  const [photoLink, setPhotoLink] = useState('');
  const [loadingPhoto, setLoadingPhoto] = useState(false);
  const [lookingUp, setLookingUp] = useState(false);
  const [lookupNote, setLookupNote] = useState<string | null>(null);
  const [lookedUpUrl, setLookedUpUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const dlg = dialogRef.current;
    if (!dlg) return;
    if (open && !dlg.open) dlg.showModal();
    if (!open && dlg.open) dlg.close();
  }, [open]);

  if (useOpenedWith(open, initial)) {
    const image = initial?.imageUrl ?? null;
    setName(initial?.name ?? '');
    setPrice(toMoneyInput(initial?.estimatedPrice));
    setPriority(initial?.priority ?? 'medium');
    setProductUrl(initial?.productUrl ?? '');
    setPhoto(image?.startsWith('data:') ? image : null);
    setPhotoLink(image && !image.startsWith('data:') ? image : '');
    setLookupNote(null);
    setLookedUpUrl(initial?.productUrl ?? null);
    setError(null);
  }

  /** Lê nome, preço e foto na página da loja e preenche o que faltar (o preço sempre, é o de agora). */
  async function handleLookup(raw = productUrl) {
    const link = parseHttpUrl(raw, ['http:', 'https:']);
    if (!link) return setError('Cole o link da loja (começando com http:// ou https://).');
    setLookingUp(true);
    setLookupNote(null);
    setError(null);
    setLookedUpUrl(link);
    const result = await lookupProduct(link);
    setLookingUp(false);
    if (!result.ok) return setLookupNote(`${result.error} Preencha à mão; o app tenta de novo depois.`);
    const { info } = result;
    if (info.name) setName((current) => current.trim() || info.name!.slice(0, 120));
    if (info.price !== null) setPrice(toMoneyInput(info.price));
    if (info.imageUrl && !photo) setPhotoLink((current) => current.trim() || info.imageUrl!);
    setLookupNote('Dados da loja preenchidos. O preço será acompanhado automaticamente.');
  }

  async function handleFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setLoadingPhoto(true);
    const thumb = await imageThumbnail(file);
    setLoadingPhoto(false);
    if (!thumb) return setError('Não consegui abrir essa imagem. Tente uma foto em JPG ou PNG.');
    setPhoto(thumb);
    setPhotoLink('');
    setError(null);
  }

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!name.trim()) return setError('Dê um nome ao desejo.');
    const priceNum = (price.trim() ? parseMoneyInput(price) : null) || null;
    if (priceNum !== null && priceNum < 0) return setError('Preço inválido.');
    const link = parseHttpUrl(productUrl, ['http:', 'https:']);
    if (link === undefined) return setError('O link da loja precisa começar com http:// ou https://.');
    const imageLink = parseHttpUrl(photoLink, ['https:']);
    if (imageLink === undefined) return setError('O link da foto precisa começar com https://.');

    const today = todayISO();
    const history = initial?.priceHistory ?? [];
    // Mudar o preço aqui também anota no acompanhamento.
    const priceHistory =
      priceNum !== null && priceNum !== initial?.estimatedPrice ? withPrice(history, priceNum, today) : history;

    const fields = {
      name: name.trim(),
      listType: 'wishlist' as const,
      estimatedPrice: priceNum,
      priority,
      imageUrl: photo ?? imageLink,
      // Só manda o link quando muda: link novo zera a última leitura automática no servidor.
      ...(link !== (initial?.productUrl ?? null) ? { productUrl: link } : {}),
      priceHistory,
    };
    if (initial) updateShoppingItem(initial.id, fields);
    else addShoppingItem(fields);
    onClose();
  }

  const preview = photo ?? (parseHttpUrl(photoLink, ['https:']) || null);

  return (
    <dialog
      ref={dialogRef}
      className="modal modal-bottom sm:modal-middle"
      onClose={onClose}
      onCancel={onClose}
    >
      <div className="modal-box max-w-md">
        <h3 className="text-lg font-bold">{initial ? 'Editar desejo' : 'Novo desejo'}</h3>
        <form onSubmit={handleSubmit} className="mt-4 grid gap-3">
          <label className="form-control">
            <span className="label-text">Link da loja</span>
            <div className="join w-full">
              <div className="input input-bordered join-item w-full">
                <Link2 className="text-base-content/50 h-4 w-4" aria-hidden />
                <input
                  className="grow"
                  inputMode="url"
                  value={productUrl}
                  onChange={(e) => setProductUrl(e.target.value)}
                  onPaste={(e) => {
                    const pasted = e.clipboardData.getData('text').trim();
                    if (pasted && !initial) void handleLookup(pasted);
                  }}
                  onBlur={() => {
                    const link = parseHttpUrl(productUrl, ['http:', 'https:']);
                    if (link && link !== lookedUpUrl && !lookingUp) void handleLookup();
                  }}
                  placeholder="Cole o link e o app busca o resto"
                />
              </div>
              <button
                type="button"
                className="btn btn-neutral join-item"
                onClick={() => void handleLookup()}
                disabled={lookingUp || !productUrl.trim()}
                aria-label="Buscar dados na loja"
              >
                {lookingUp ? (
                  <span className="loading loading-spinner loading-sm" aria-hidden />
                ) : (
                  <Search className="h-5 w-5" aria-hidden />
                )}
              </button>
            </div>
            {lookingUp && <span className="text-base-content/60 mt-1 text-xs">Buscando na loja…</span>}
            {lookupNote && !lookingUp && <span className="text-base-content/70 mt-1 text-xs">{lookupNote}</span>}
          </label>

          <div className="flex items-center gap-3">
            <div className="bg-base-200 grid h-24 w-24 shrink-0 place-items-center overflow-hidden rounded-box border-2 border-black">
              {loadingPhoto ? (
                <span className="loading loading-spinner" aria-label="Carregando foto" />
              ) : preview ? (
                // eslint-disable-next-line @next/next/no-img-element -- miniatura em data URL ou link livre
                <img src={preview} alt="" className="h-full w-full object-cover" />
              ) : (
                <Gift className="text-base-content/40 h-10 w-10" aria-hidden />
              )}
            </div>
            <div className="grid min-w-0 flex-1 gap-2">
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
              <button
                type="button"
                className="btn btn-ghost bg-base-200 min-h-11"
                onClick={() => fileRef.current?.click()}
              >
                <Camera className="h-5 w-5" aria-hidden /> {preview ? 'Trocar foto' : 'Adicionar foto'}
              </button>
              {preview && (
                <button
                  type="button"
                  className="btn btn-ghost btn-sm text-error"
                  onClick={() => {
                    setPhoto(null);
                    setPhotoLink('');
                  }}
                >
                  <Trash2 className="h-4 w-4" aria-hidden /> Remover foto
                </button>
              )}
            </div>
          </div>

          {!photo && (
            <label className="form-control">
              <span className="label-text">Ou cole o link da imagem</span>
              <input
                className="input input-bordered w-full"
                inputMode="url"
                value={photoLink}
                onChange={(e) => setPhotoLink(e.target.value)}
                placeholder="https://…/foto.jpg"
              />
            </label>
          )}

          <label className="form-control">
            <span className="label-text">O que você quer</span>
            <input
              className="input input-bordered w-full"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Fone com cancelamento de ruído"
              maxLength={120}
              required
            />
          </label>

          <label className="form-control">
            <span className="label-text">Preço atual</span>
            <MoneyInput value={price} onChange={setPrice} placeholder="Opcional" />
            {initial && (
              <span className="text-base-content/60 mt-1 text-xs">
                Mudar o preço registra o valor de hoje no histórico.
              </span>
            )}
          </label>

          <fieldset className="grid gap-2">
            <legend className="label-text mb-1">Prioridade</legend>
            <div className="grid grid-cols-3 gap-2">
              {PRIORITIES.map((p) => (
                <button
                  key={p.value}
                  type="button"
                  aria-pressed={priority === p.value}
                  className={`btn min-h-11 ${priority === p.value ? 'btn-neutral' : 'btn-ghost bg-base-200'}`}
                  onClick={() => setPriority(p.value)}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </fieldset>

          {error && (
            <div role="alert" className="alert alert-error">
              <span>{error}</span>
            </div>
          )}

          <div className="modal-action mt-2">
            <button type="button" className="btn btn-ghost" onClick={onClose}>
              Cancelar
            </button>
            <button type="submit" className="btn btn-primary" disabled={loadingPhoto || lookingUp}>
              {initial ? 'Salvar' : 'Adicionar'}
            </button>
          </div>
        </form>
      </div>
      <form method="dialog" className="modal-backdrop">
        <button aria-label="Fechar">fechar</button>
      </form>
    </dialog>
  );
}
