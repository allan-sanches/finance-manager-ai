'use client';

import { Eye, EyeOff, Plus, X } from 'lucide-react';
import { useState, type FormEvent } from 'react';

import { CategoryAvatar } from '@/components/CategoryAvatar';
import { SectionTitle } from '@/components/ui';
import { CATEGORIES } from '@/lib/finance';
import { useFinanceStore } from '@/lib/store';
import { normalizeCategoryName, TONE_CLASS, TONES, type Tone } from '@/lib/tones';

const EMOJI_SUGGESTIONS = ['🐾', '🎮', '✈️', '👶', '🎁', '💇', '🛠️', '⛽', '🏋️', '☕', '💼', '🧾'];

export function CategorySettings() {
  const categories = useFinanceStore((s) => s.categories);
  const addCategory = useFinanceStore((s) => s.addCategory);
  const removeCategory = useFinanceStore((s) => s.removeCategory);
  const hiddenList = useFinanceStore((s) => s.settings.hiddenCategories);
  const updateSettings = useFinanceStore((s) => s.updateSettings);

  // Oculta = some das listas, gráficos e totais (o saldo das contas e o limite dos cartões seguem reais).
  const hidden = new Set((hiddenList ?? []).map(normalizeCategoryName));
  const isHidden = (name: string) => hidden.has(normalizeCategoryName(name));
  function toggleHidden(name: string) {
    const current = hiddenList ?? [];
    updateSettings({
      hiddenCategories: isHidden(name)
        ? current.filter((n) => normalizeCategoryName(n) !== normalizeCategoryName(name))
        : [...current, name],
    });
  }
  const hideButton = (name: string) => (
    <button
      type="button"
      className={`btn btn-ghost btn-sm btn-square ${isHidden(name) ? 'text-warning' : ''}`}
      aria-pressed={isHidden(name)}
      aria-label={isHidden(name) ? `Mostrar ${name}` : `Ocultar ${name}`}
      title={isHidden(name) ? 'Oculta: fora das listas e dos totais' : 'Ocultar das listas e dos totais'}
      onClick={() => toggleHidden(name)}
    >
      {isHidden(name) ? <EyeOff className="h-4 w-4" aria-hidden /> : <Eye className="h-4 w-4" aria-hidden />}
    </button>
  );

  const [name, setName] = useState('');
  const [emoji, setEmoji] = useState(EMOJI_SUGGESTIONS[0]);
  const [tone, setTone] = useState<Tone>('amber');

  const taken = new Set([...CATEGORIES, ...categories.map((c) => c.name)].map(normalizeCategoryName));
  const trimmed = name.trim();
  const duplicate = trimmed !== '' && taken.has(normalizeCategoryName(trimmed));

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!trimmed || duplicate || !emoji.trim()) return;
    addCategory({ name: trimmed, emoji: emoji.trim(), tone });
    setName('');
  }

  return (
    <section id="categorias" className="panel scroll-mt-20 p-4 sm:p-6">
      <SectionTitle>Categorias</SectionTitle>

      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <div className="flex gap-2">
          <input
            className="input input-bordered w-16 text-center text-xl"
            aria-label="Emoji da categoria"
            value={emoji}
            maxLength={16}
            onChange={(e) => setEmoji(e.target.value)}
          />
          <input
            className="input input-bordered min-w-0 flex-1"
            placeholder="Nome, ex: Pet"
            aria-label="Nome da categoria"
            value={name}
            maxLength={40}
            onChange={(e) => setName(e.target.value)}
          />
        </div>

        <div className="no-scrollbar -mx-1 flex gap-1.5 overflow-x-auto px-1">
          {EMOJI_SUGGESTIONS.map((e) => (
            <button
              key={e}
              type="button"
              className={`btn btn-ghost btn-square btn-sm shrink-0 text-lg ${emoji === e ? 'bg-base-200' : ''}`}
              onClick={() => setEmoji(e)}
              aria-label={`Usar ${e}`}
            >
              {e}
            </button>
          ))}
        </div>

        <fieldset className="flex flex-wrap gap-2" aria-label="Cor da categoria">
          {TONES.map((t) => (
            <button
              key={t}
              type="button"
              aria-label={`Cor ${t}`}
              aria-pressed={tone === t}
              className={`h-9 w-9 rounded-xl border-2 ${TONE_CLASS[t]} ${
                tone === t ? 'border-base-content scale-110' : 'border-transparent'
              } transition`}
              onClick={() => setTone(t)}
            />
          ))}
        </fieldset>

        <div className="flex items-center gap-3">
          <span className={`grid h-11 w-11 place-items-center rounded-xl text-xl ${TONE_CLASS[tone]}`} aria-hidden>
            {emoji}
          </span>
          <span className="flex-1 truncate font-semibold">{trimmed || 'Prévia'}</span>
          <button type="submit" className="btn btn-primary" disabled={!trimmed || duplicate || !emoji.trim()}>
            <Plus className="h-5 w-5" aria-hidden /> Criar
          </button>
        </div>
        {duplicate && <p className="text-error text-sm">Já existe uma categoria com esse nome.</p>}
      </form>

      <div className="divider my-4" />
      <p className="text-base-content/60 mb-2 text-xs">
        Toque no olho para ocultar uma categoria: os lançamentos dela saem das listas, gráficos e totais. O
        saldo das contas e o limite dos cartões continuam contando tudo.
      </p>

      <ul className="flex flex-col gap-1">
        {categories.map((c) => (
          <li key={c.id} className="flex min-h-12 items-center gap-3">
            <CategoryAvatar category={c.name} size="sm" />
            <span className={`flex-1 truncate font-semibold ${isHidden(c.name) ? 'line-through opacity-60' : ''}`}>
              {c.name}
            </span>
            {hideButton(c.name)}
            <button
              type="button"
              className="btn btn-ghost btn-sm btn-square text-error"
              aria-label={`Apagar ${c.name}`}
              onClick={() => {
                if (
                  confirm(
                    `Apagar a categoria "${c.name}"? Os lançamentos continuam com esse nome, só perdem a cor e o emoji.`,
                  )
                ) {
                  removeCategory(c.id);
                }
              }}
            >
              <X className="h-4 w-4" aria-hidden />
            </button>
          </li>
        ))}
        {CATEGORIES.map((name) => (
          <li key={name} className="flex min-h-12 items-center gap-3">
            <CategoryAvatar category={name} size="sm" />
            <span className={`flex-1 truncate ${isHidden(name) ? 'line-through opacity-60' : 'opacity-70'}`}>{name}</span>
            <span className="text-base-content/50 text-xs">padrão</span>
            {hideButton(name)}
          </li>
        ))}
      </ul>
    </section>
  );
}
