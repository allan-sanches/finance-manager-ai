'use client';

import { useMemo, useState, type FormEvent } from 'react';

import { BRL } from '@/lib/finance';
import { useFinanceStore } from '@/lib/store';
import { useHydrated } from '@/lib/useHydratedStore';
import type { ListType, ShoppingItem } from '@/types/finance';

const PRIORITY_LABEL: Record<NonNullable<ShoppingItem['priority']>, string> = {
  low: 'Baixa',
  medium: 'Média',
  high: 'Alta',
};

const PRIORITY_BADGE: Record<NonNullable<ShoppingItem['priority']>, string> = {
  low: 'badge-ghost',
  medium: 'badge-info',
  high: 'badge-error',
};

export default function ListasPage() {
  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold md:text-3xl">Listas</h1>
        <p className="text-base-content/60 text-sm">
          Compras da casa e desejos. Marque com um clique, acompanhe preços e prioridades.
        </p>
      </header>

      <div className="grid gap-4 lg:grid-cols-2">
        <ShoppingList
          listType="household"
          title="Compras da casa"
          subtitle="Itens recorrentes e do dia a dia"
        />
        <ShoppingList
          listType="wishlist"
          title="Lista de desejos"
          subtitle="Com valor estimado e prioridade"
        />
      </div>
    </div>
  );
}

function ShoppingList({
  listType,
  title,
  subtitle,
}: {
  listType: ListType;
  title: string;
  subtitle: string;
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
    const price = estimatedPrice ? Number(estimatedPrice.replace(',', '.')) : null;
    addItem({
      name: name.trim(),
      listType,
      estimatedPrice: price && Number.isFinite(price) ? price : null,
      priority: listType === 'wishlist' ? priority : undefined,
    });
    setName('');
    setEstimatedPrice('');
    setPriority('medium');
  }

  const totalEstimated = items.reduce((sum, i) => sum + (i.estimatedPrice ?? 0), 0);

  return (
    <section className="card bg-base-200 shadow">
      <div className="card-body">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="card-title">{title}</h2>
            <p className="text-base-content/60 text-xs">{subtitle}</p>
          </div>
          {totalEstimated > 0 && (
            <span className="badge badge-outline">{BRL.format(totalEstimated)}</span>
          )}
        </div>

        <form onSubmit={handleAdd} className="mt-2 grid gap-2">
          <div className="join w-full">
            <input
              className="input input-bordered join-item w-full"
              placeholder={listType === 'household' ? 'Ex: Arroz, sabão…' : 'Ex: PS5, Curso de…'}
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={80}
            />
            <button type="submit" className="btn btn-primary join-item" disabled={!name.trim()}>
              +
            </button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <input
              className="input input-bordered input-sm"
              inputMode="decimal"
              placeholder="Preço estimado (opcional)"
              value={estimatedPrice}
              onChange={(e) => setEstimatedPrice(e.target.value)}
            />
            {listType === 'wishlist' && (
              <select
                className="select select-bordered select-sm"
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
                className="hover:bg-base-300/50 group flex items-center gap-3 rounded-md px-2 py-1.5 transition"
              >
                <input
                  type="checkbox"
                  className="checkbox checkbox-sm"
                  checked={item.isPurchased}
                  onChange={() => toggleItem(item.id)}
                  aria-label={`Marcar ${item.name} como comprado`}
                />
                <span
                  className={`flex-1 text-sm ${
                    item.isPurchased ? 'text-base-content/50 line-through' : ''
                  }`}
                >
                  {item.name}
                </span>
                {item.priority && listType === 'wishlist' && (
                  <span className={`badge badge-sm ${PRIORITY_BADGE[item.priority]}`}>
                    {PRIORITY_LABEL[item.priority]}
                  </span>
                )}
                {item.estimatedPrice != null && (
                  <span className="text-base-content/60 text-xs">
                    {BRL.format(item.estimatedPrice)}
                  </span>
                )}
                <button
                  type="button"
                  className="btn btn-ghost btn-xs text-error opacity-0 transition group-hover:opacity-100"
                  onClick={() => removeItem(item.id)}
                  aria-label={`Remover ${item.name}`}
                >
                  ✕
                </button>
              </li>
            ))
          )}
        </ul>
      </div>
    </section>
  );
}
