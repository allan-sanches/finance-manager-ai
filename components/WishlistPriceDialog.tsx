'use client';

import { RefreshCw, TrendingDown, TrendingUp, X } from 'lucide-react';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

import { MoneyInput } from '@/components/MoneyInput';
import { BRL, shortDate, todayISO } from '@/lib/finance';
import { parseMoneyInput } from '@/lib/money-mask';
import { useFinanceStore } from '@/lib/store';
import { TONE_HEX } from '@/lib/tones';
import { useOpenedWith } from '@/lib/useMounted';
import { checkedAgo, latestPrice, priceTrend, withPrice } from '@/lib/wishlist';
import type { PricePoint, ShoppingItem } from '@/types/finance';

type Props = {
  open: boolean;
  onClose: () => void;
  item?: ShoppingItem;
};

const tooltipStyle = {
  background: 'var(--color-base-100)',
  border: '1px solid color-mix(in oklab, var(--color-base-content) 12%, transparent)',
  borderRadius: 12,
  color: 'var(--color-base-content)',
};

const BRL_COMPACT = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  notation: 'compact',
  maximumFractionDigits: 1,
});

/** Anota o preço do dia e mostra como ele andou desde que o desejo foi cadastrado. */
export function WishlistPriceDialog({ open, onClose, item }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const updateShoppingItem = useFinanceStore((s) => s.updateShoppingItem);
  const refreshWishPrices = useFinanceStore((s) => s.refreshWishPrices);
  const [checking, setChecking] = useState(false);
  const [checkNote, setCheckNote] = useState<string | null>(null);
  // Lê do store para o gráfico refletir na hora o preço que acabou de ser anotado.
  const live = useFinanceStore((s) => s.shoppingItems.find((i) => i.id === item?.id)) ?? item;

  const [price, setPrice] = useState('');
  const [date, setDate] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const dlg = dialogRef.current;
    if (!dlg) return;
    if (open && !dlg.open) dlg.showModal();
    if (!open && dlg.open) dlg.close();
  }, [open]);

  if (useOpenedWith(open, item?.id)) {
    setPrice('');
    setDate(todayISO());
    setError(null);
    setCheckNote(null);
  }

  async function handleCheckNow() {
    if (!live) return;
    setChecking(true);
    setCheckNote(null);
    const result = await refreshWishPrices(live.id);
    setChecking(false);
    if (!result) return setCheckNote('Não foi possível conferir agora.');
    if (result.limited) return setCheckNote('Muitas conferências na última hora. Tente mais tarde.');
  }

  const history = live?.priceHistory ?? [];
  const trend = live ? priceTrend(live) : null;

  function save(next: PricePoint[]) {
    if (!live) return;
    updateShoppingItem(live.id, { priceHistory: next, estimatedPrice: latestPrice(next) });
  }

  function handleAdd(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const value = parseMoneyInput(price);
    if (!value || value <= 0) return setError('Informe o preço.');
    if (!date || date > todayISO()) return setError('Escolha uma data até hoje.');
    save(withPrice(history, value, date));
    setPrice('');
    setError(null);
  }

  const chartData = history.map((p) => ({ date: shortDate(p.date), price: p.price }));

  return (
    <dialog
      ref={dialogRef}
      className="modal modal-bottom sm:modal-middle"
      onClose={onClose}
      onCancel={onClose}
    >
      <div className="modal-box max-w-md">
        <h3 className="truncate text-lg font-bold">{live?.name ?? 'Preço'}</h3>
        <p className="text-base-content/60 text-sm">Acompanhamento de preço</p>

        {trend && (
          <div className="mt-3 grid grid-cols-3 gap-2 text-center">
            <Stat label="Agora" value={BRL.format(trend.current)} />
            <Stat label="Menor" value={BRL.format(trend.lowest)} />
            <Stat label="Maior" value={BRL.format(trend.highest)} />
          </div>
        )}

        {trend && trend.change !== 0 && (
          <p
            className={`mt-2 flex items-center gap-1 text-sm font-semibold ${
              trend.change < 0 ? 'text-success' : 'text-error'
            }`}
          >
            {trend.change < 0 ? (
              <TrendingDown className="h-4 w-4" aria-hidden />
            ) : (
              <TrendingUp className="h-4 w-4" aria-hidden />
            )}
            {trend.change < 0 ? 'Baixou' : 'Subiu'} {BRL.format(Math.abs(trend.change))} (
            {Math.abs(trend.changePercent).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%) desde o
            preço anterior
          </p>
        )}

        {chartData.length > 1 && (
          <div className="mt-3 h-44 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                <CartesianGrid vertical={false} strokeOpacity={0.12} />
                <XAxis
                  dataKey="date"
                  stroke="currentColor"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                  minTickGap={24}
                />
                <YAxis
                  width="auto"
                  stroke="currentColor"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                  domain={['auto', 'auto']}
                  tickFormatter={(value: number) => BRL_COMPACT.format(value)}
                />
                <Tooltip
                  formatter={(value) => [BRL.format(Number(value)), 'Preço']}
                  contentStyle={tooltipStyle}
                />
                <Line
                  dataKey="price"
                  stroke={TONE_HEX.violet}
                  strokeWidth={2}
                  type="stepAfter"
                  dot={chartData.length <= 30 ? { r: 4, strokeWidth: 2, fill: 'var(--color-base-100)' } : false}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}

        {live?.productUrl && !live.isPurchased && (
          <div className="bg-base-200 rounded-box mt-4 flex items-center gap-3 p-3">
            <p className="text-base-content/70 min-w-0 flex-1 text-xs">
              {live.priceCheckError
                ? `Última leitura automática falhou: ${live.priceCheckError}`
                : live.priceCheckedAt
                  ? `Preço lido na loja ${checkedAgo(live.priceCheckedAt)}. O app confere sozinho a cada 6 h e anota um ponto por dia.`
                  : 'O app confere o preço na loja sozinho a cada 6 h e anota um ponto por dia.'}
              {checkNote && <span className="text-warning block">{checkNote}</span>}
            </p>
            <button
              type="button"
              className="btn btn-sm btn-neutral min-h-11 shrink-0"
              onClick={() => void handleCheckNow()}
              disabled={checking}
            >
              {checking ? (
                <span className="loading loading-spinner loading-xs" aria-hidden />
              ) : (
                <RefreshCw className="h-4 w-4" aria-hidden />
              )}
              Conferir agora
            </button>
          </div>
        )}

        <form onSubmit={handleAdd} className="mt-4 grid gap-2">
          <span className="label-text">Anotar preço à mão</span>
          <div className="grid grid-cols-[1fr_auto] gap-2">
            <MoneyInput value={price} onChange={setPrice} aria-label="Preço visto" />
            <input
              type="date"
              className="input input-bordered"
              aria-label="Dia em que viu o preço"
              value={date}
              max={todayISO()}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>
          <button type="submit" className="btn btn-primary min-h-11">
            Anotar
          </button>
        </form>

        {error && (
          <div role="alert" className="alert alert-error mt-3">
            <span>{error}</span>
          </div>
        )}

        {history.length > 0 && (
          <ul className="mt-4 grid gap-1">
            {/* Leituras diárias repetem o preço: a lista mostra só quando ele mudou. */}
            {history
              .filter((p, i) => i === 0 || p.price !== history[i - 1].price)
              .reverse()
              .map((p, i, list) => {
              const older = list[i + 1];
              const diff = older ? p.price - older.price : 0;
              return (
                <li key={p.date} className="bg-base-200 flex min-h-11 items-center gap-3 rounded-field px-3">
                  <span className="text-base-content/60 w-16 shrink-0 text-sm">{shortDate(p.date)}</span>
                  <span className="flex-1 font-semibold tabular-nums">{BRL.format(p.price)}</span>
                  {diff !== 0 && (
                    <span className={`text-xs font-semibold tabular-nums ${diff < 0 ? 'text-success' : 'text-error'}`}>
                      {diff < 0 ? '−' : '+'}
                      {BRL.format(Math.abs(diff))}
                    </span>
                  )}
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm btn-square text-error"
                    aria-label={`Apagar preço de ${shortDate(p.date)}`}
                    onClick={() => save(history.filter((h) => h.date !== p.date))}
                  >
                    <X className="h-4 w-4" aria-hidden />
                  </button>
                </li>
              );
            })}
          </ul>
        )}

        <div className="modal-action">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Fechar
          </button>
        </div>
      </div>
      <form method="dialog" className="modal-backdrop">
        <button aria-label="Fechar">fechar</button>
      </form>
    </dialog>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-base-200 rounded-box px-2 py-2">
      <p className="text-base-content/60 text-xs font-semibold">{label}</p>
      <p className="truncate text-sm font-bold tabular-nums">{value}</p>
    </div>
  );
}
