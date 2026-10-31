'use client';

import { Plus, X } from 'lucide-react';
import { useMemo, useState, type FormEvent } from 'react';

import { MoneyInput } from '@/components/MoneyInput';
import { PageHeader } from '@/components/ui';

import { BRL } from '@/lib/finance';
import { parseMoneyInput } from '@/lib/money-mask';
import { useFinanceStore } from '@/lib/store';
import { useHydrated } from '@/lib/useHydratedStore';
import type { ListType, ShoppingItem } from '@/types/finance';

const PRIORITY_LABEL: Record<NonNullable<ShoppingItem['priority']>, string> = {
  low: 'Baixa',
  medium: 'Média',
  high: 'Alta',
};

const PRIORITY_BADGE: Record<NonNullable<ShoppingItem['priority']>, string> = {
  low: 'bg-slate-200 text-neutral-900',
  medium: 'bg-cyan-300 text-neutral-900',
  high: 'bg-pink-500 text-white',
};

export default function ListasPage() {
  return (
    <div className="mx-auto flex max-w-5xl flex-col">
      <PageHeader title="Listas" subtitle="Compras da casa e desejos, com preço e prioridade." />

      <div className="grid gap-4 lg:grid-cols-2">
        <ShoppingList
          listType="household"
          title="🛒 Compras da casa"
          subtitle="Itens recorrentes e do dia a dia"
          tone="bg-lime-300 text-neutral-900"
        />
        <ShoppingList
          listType="wishlist"
          title="✨ Lista de desejos"
          subtitle="Com valor estimado e prioridade"
          tone="bg-violet-500 text-white"
        />
      </div>
    </div>
  );
}

function ShoppingList({
  listType,
  title,
  subtitle,
  tone,
}: {
  listType: ListType;
  title: string;
  subtitle: string;
  tone: string;
}) {
  const hydrated = useHydrated();
  const allItems = useFinanceStore((s) => s.shoppingItems);
  const addItem = useFinanceStore((s) => s.addShoppingItem);
  const toggleItem = useFinanceStore((s) => s.toggleShoppingItem);
  const removeItem = useFinanceStore((s) => s.removeShoppingItem);

  const items = useMemo(
    () =>
      allItems
        .filter((i) => i.listType === listType)
        .sort((a, b) => Number(a.isPurchased) - Number(b.isPurchased)),
    [allItems, listType],
  );

  const [name, setName] = useState('');
  const [estimatedPrice, setEstimatedPrice] = useState('');
  const [priority, setPriority] = useState<'low' | 'medium' | 'high'>('medium');

  function handleAdd(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!name.trim()) return;
    const price = parseMoneyInput(estimatedPrice);
    addItem({
      name: name.trim(),
      listType,
      estimatedPrice: price || null,
      priority: listType === 'wishlist' ? priority : undefined,
    });
    setName('');
    setEstimatedPrice('');
    setPriority('medium');
  }

  const totalEstimated = items.reduce((sum, i) => sum + (i.estimatedPrice ?? 0), 0);

  return (
    <section className="panel overflow-hidden">
      <div className={`flex items-start justify-between gap-2 p-4 ${tone}`}>
        <div>
          <h2 className="text-lg font-extrabold">{title}</h2>
          <p className="text-xs font-semibold opacity-80">{subtitle}</p>
        </div>
        {totalEstimated > 0 && <span className="sticker bg-white">{BRL.format(totalEstimated)}</span>}
      </div>
      <div className="p-4">

        <form onSubmit={handleAdd} className="mt-2 grid gap-2">
          <div className="join w-full">
            <input
              className="input input-bordered join-item w-full"
              placeholder={listType === 'household' ? 'Ex: Arroz, sabão…' : 'Ex: PS5, Curso de…'}
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={80}
            />
            <button
              type="submit"
              className="btn btn-primary join-item"
              disabled={!name.trim()}
              aria-label="Adicionar item"
            >
              <Plus className="h-5 w-5" aria-hidden />
            </button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <MoneyInput
              placeholder="Preço (opcional)"
              aria-label="Preço estimado"
              value={estimatedPrice}
              onChange={setEstimatedPrice}
            />
            {listType === 'wishlist' && (
              <select
                className="select select-bordered"
                value={priority}
                onChange={(e) => setPriority(e.target.value as 'low' | 'medium' | 'high')}
              >
                <option value="low">Prioridade baixa</option>
                <option value="medium">Prioridade média</option>
                <option value="high">Prioridade alta</option>
              </select>
            )}
          </div>
        </form>

        <ul className="mt-3 space-y-1">
          {!hydrated ? (
            <li className="text-base-content/60 py-6 text-center text-sm">Carregando…</li>
          ) : items.length === 0 ? (
            <li className="text-base-content/60 py-6 text-center text-sm">
              {listType === 'household'
                ? 'Sua lista está vazia.'
                : 'Sem desejos cadastrados ainda.'}
            </li>
          ) : (
            items.map((item) => (
              <li
                key={item.id}
                className="hover:bg-base-200 group flex min-h-12 items-center gap-3 rounded-field px-2 py-1.5 transition"
              >
                <input
                  type="checkbox"
                  className="checkbox checkbox-primary"
                  checked={item.isPurchased}
                  onChange={() => toggleItem(item.id)}
                  aria-label={`Marcar ${item.name} como comprado`}
                />
                <span
                  className={`min-w-0 flex-1 truncate font-medium ${
                    item.isPurchased ? 'text-base-content/50 line-through' : ''
                  }`}
                >
                  {item.name}
                </span>
                {item.priority && listType === 'wishlist' && (
                  <span className={`badge badge-sm shrink-0 border-0 font-bold ${PRIORITY_BADGE[item.priority]}`}>
                    {PRIORITY_LABEL[item.priority]}
                  </span>
                )}
                {item.estimatedPrice != null && (
                  <span className="text-base-content/60 shrink-0 text-xs tabular-nums">
                    {BRL.format(item.estimatedPrice)}
                  </span>
                )}
                <button
                  type="button"
                  className="btn btn-ghost btn-sm btn-square text-error transition [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100"
                  onClick={() => removeItem(item.id)}
                  aria-label={`Remover ${item.name}`}
                >
                  <X className="h-4 w-4" aria-hidden />
                </button>
              </li>
            ))
          )}
        </ul>
      </div>
    </section>
  );
}
