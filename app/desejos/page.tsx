'use client';

import {
  Check,
  ExternalLink,
  Gift,
  LineChart,
  Pencil,
  Plus,
  RefreshCw,
  RotateCcw,
  Trash2,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';

import { EmptyState, PageHeader } from '@/components/ui';
import { WishlistItemFormDialog } from '@/components/WishlistItemFormDialog';
import { WishlistPriceDialog } from '@/components/WishlistPriceDialog';
import { BRL } from '@/lib/finance';
import { useFinanceStore } from '@/lib/store';
import { useHydrated } from '@/lib/useHydratedStore';
import { checkedAgo, priceTrend, sortWishes } from '@/lib/wishlist';
import type { ShoppingItem } from '@/types/finance';

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

type Tab = 'open' | 'purchased';

export default function DesejosPage() {
  const hydrated = useHydrated();
  const allItems = useFinanceStore((s) => s.shoppingItems);
  const refreshWishPrices = useFinanceStore((s) => s.refreshWishPrices);
  const [refreshing, setRefreshing] = useState(false);
  const refreshedOnce = useRef(false);

  // Ao abrir, lê na loja os preços que não são vistos há 6h (a rotina do servidor também faz isso
  // sozinha a cada 6h; aqui é para a tela não esperar por ela).
  useEffect(() => {
    if (!hydrated || refreshedOnce.current) return;
    refreshedOnce.current = true;
    setRefreshing(true);
    void refreshWishPrices().finally(() => setRefreshing(false));
  }, [hydrated, refreshWishPrices]);

  const [tab, setTab] = useState<Tab>('open');
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<ShoppingItem | undefined>(undefined);
  const [pricing, setPricing] = useState<ShoppingItem | undefined>(undefined);

  const wishes = useMemo(() => allItems.filter((i) => i.listType === 'wishlist'), [allItems]);
  const open = useMemo(() => sortWishes(wishes.filter((i) => !i.isPurchased)), [wishes]);
  const purchased = useMemo(() => wishes.filter((i) => i.isPurchased), [wishes]);
  const visible = tab === 'open' ? open : purchased;

  const total = open.reduce((sum, i) => sum + (i.estimatedPrice ?? 0), 0);
  const cheaper = open.filter((i) => (priceTrend(i)?.change ?? 0) < 0).length;

  function startNew() {
    setEditing(undefined);
    setFormOpen(true);
  }

  return (
    <div className="mx-auto flex max-w-5xl flex-col">
      <PageHeader
        title="Lista de desejos"
        subtitle="O que você quer comprar, com foto e o preço acompanhado."
        action={
          <button type="button" className="btn btn-primary" onClick={startNew}>
            <Plus className="h-5 w-5" aria-hidden /> Novo desejo
          </button>
        }
      />

      {hydrated && wishes.length > 0 && (
        <div className="mb-4 grid grid-cols-3 gap-2">
          <Summary label="Desejos" value={String(open.length)} tone="bg-violet-500 text-white" />
          <Summary label="Total" value={BRL.format(total)} tone="bg-lime-300 text-neutral-900" />
          <Summary label="Baixaram" value={String(cheaper)} tone="bg-cyan-300 text-neutral-900" />
        </div>
      )}

      {refreshing && (
        <p className="text-base-content/60 mb-3 flex items-center gap-2 text-sm" role="status">
          <span className="loading loading-spinner loading-xs" aria-hidden /> Conferindo os preços nas lojas…
        </p>
      )}

      {hydrated && purchased.length > 0 && (
        <div role="tablist" className="tabs tabs-box mb-4 self-start">
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'open'}
            className={`tab min-h-11 ${tab === 'open' ? 'tab-active' : ''}`}
            onClick={() => setTab('open')}
          >
            Desejando ({open.length})
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'purchased'}
            className={`tab min-h-11 ${tab === 'purchased' ? 'tab-active' : ''}`}
            onClick={() => setTab('purchased')}
          >
            Comprados ({purchased.length})
          </button>
        </div>
      )}

      {!hydrated ? (
        <p className="text-base-content/60 py-10 text-center text-sm">Carregando…</p>
      ) : visible.length === 0 ? (
        <EmptyState
          emoji={tab === 'open' ? '✨' : '🛍️'}
          title={tab === 'open' ? 'Nenhum desejo por aqui' : 'Nada comprado ainda'}
        >
          {tab === 'open' && (
            <>
              <p>Adicione o que você quer comprar, com foto e preço, e acompanhe quando ficar mais barato.</p>
              <button type="button" className="btn btn-primary mt-3" onClick={startNew}>
                <Plus className="h-5 w-5" aria-hidden /> Novo desejo
              </button>
            </>
          )}
        </EmptyState>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((item) => (
            <WishCard
              key={item.id}
              item={item}
              onEdit={() => {
                setEditing(item);
                setFormOpen(true);
              }}
              onPrice={() => setPricing(item)}
            />
          ))}
        </ul>
      )}

      <WishlistItemFormDialog open={formOpen} onClose={() => setFormOpen(false)} initial={editing} />
      <WishlistPriceDialog open={pricing !== undefined} onClose={() => setPricing(undefined)} item={pricing} />
    </div>
  );
}

function Summary({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <div className={`rounded-box border-2 border-black px-3 py-2 ${tone}`}>
      <p className="text-xs font-semibold opacity-80">{label}</p>
      <p className="truncate text-lg font-extrabold tabular-nums">{value}</p>
    </div>
  );
}

function WishCard({ item, onEdit, onPrice }: { item: ShoppingItem; onEdit: () => void; onPrice: () => void }) {
  const toggleItem = useFinanceStore((s) => s.toggleShoppingItem);
  const removeItem = useFinanceStore((s) => s.removeShoppingItem);
  const trend = priceTrend(item);

  function handleRemove() {
    if (confirm(`Remover "${item.name}" da lista de desejos?`)) removeItem(item.id);
  }

  return (
    <li className={`panel flex flex-col overflow-hidden ${item.isPurchased ? 'opacity-70' : ''}`}>
      <div className="bg-base-200 relative aspect-[4/3] w-full">
        {item.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- miniatura em data URL ou link livre
          <img src={item.imageUrl} alt={item.name} loading="lazy" className="h-full w-full object-cover" />
        ) : (
          <div className="grid h-full place-items-center">
            <Gift className="text-base-content/30 h-14 w-14" aria-hidden />
          </div>
        )}
        {item.priority && (
          <span className={`badge absolute top-2 left-2 border-0 font-bold ${PRIORITY_BADGE[item.priority]}`}>
            {PRIORITY_LABEL[item.priority]}
          </span>
        )}
        {trend?.isLowest && !item.isPurchased && (
          <span className="badge absolute top-2 right-2 border-0 bg-emerald-400 font-bold text-neutral-900">
            Menor preço
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-2 p-4">
        <h2 className={`line-clamp-2 font-bold ${item.isPurchased ? 'line-through' : ''}`}>{item.name}</h2>

        {trend ? (
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
            <span className="text-xl font-extrabold tabular-nums">{BRL.format(trend.current)}</span>
            {trend.change !== 0 && (
              <span
                className={`flex items-center gap-0.5 text-xs font-semibold tabular-nums ${
                  trend.change < 0 ? 'text-success' : 'text-error'
                }`}
              >
                {trend.change < 0 ? (
                  <TrendingDown className="h-3.5 w-3.5" aria-hidden />
                ) : (
                  <TrendingUp className="h-3.5 w-3.5" aria-hidden />
                )}
                <span className="sr-only">{trend.change < 0 ? 'Baixou' : 'Subiu'}</span>
                {BRL.format(Math.abs(trend.change))} (
                {Math.abs(trend.changePercent).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%)
              </span>
            )}
            {trend.lowest < trend.current && (
              <span className="text-base-content/60 w-full text-xs">Menor já visto: {BRL.format(trend.lowest)}</span>
            )}
          </div>
        ) : (
          <span className="text-base-content/60 text-sm">Sem preço ainda</span>
        )}

        {item.productUrl && !item.isPurchased && (
          <p className={`text-xs ${item.priceCheckError ? 'text-warning' : 'text-base-content/50'}`}>
            {item.priceCheckError ? (
              <>Preço automático: {item.priceCheckError}</>
            ) : item.priceCheckedAt ? (
              <>
                <RefreshCw className="mr-1 inline h-3 w-3" aria-hidden />
                Preço conferido na loja {checkedAgo(item.priceCheckedAt)}
              </>
            ) : (
              'Preço será conferido na loja em breve'
            )}
          </p>
        )}

        <div className="mt-auto flex flex-wrap gap-1 pt-2">
          <button type="button" className="btn btn-sm btn-ghost bg-base-200 min-h-11 flex-1" onClick={onPrice}>
            <LineChart className="h-4 w-4" aria-hidden /> Preço
          </button>
          {item.productUrl && (
            <a
              href={item.productUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-sm btn-ghost bg-base-200 min-h-11 flex-1"
            >
              <ExternalLink className="h-4 w-4" aria-hidden /> Loja
            </a>
          )}
          <button
            type="button"
            className={`btn btn-sm min-h-11 flex-1 ${item.isPurchased ? 'btn-ghost bg-base-200' : 'btn-success'}`}
            onClick={() => toggleItem(item.id)}
          >
            {item.isPurchased ? (
              <>
                <RotateCcw className="h-4 w-4" aria-hidden /> Voltar
              </>
            ) : (
              <>
                <Check className="h-4 w-4" aria-hidden /> Comprei
              </>
            )}
          </button>
          <button
            type="button"
            className="btn btn-sm btn-ghost btn-square min-h-11 min-w-11"
            onClick={onEdit}
            aria-label={`Editar ${item.name}`}
          >
            <Pencil className="h-4 w-4" aria-hidden />
          </button>
          <button
            type="button"
            className="btn btn-sm btn-ghost btn-square text-error min-h-11 min-w-11"
            onClick={handleRemove}
            aria-label={`Remover ${item.name}`}
          >
            <Trash2 className="h-4 w-4" aria-hidden />
          </button>
        </div>
      </div>
    </li>
  );
}
