'use client';

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { SectionTitle } from '@/components/ui';
import { BRL, cashflowLastMonths, expensesByCategory, invoiceOutflows } from '@/lib/finance';
import { useFinanceStore } from '@/lib/store';
import { TONE_HEX } from '@/lib/tones';
import { useCategories } from '@/lib/useCategories';
import { useHydrated } from '@/lib/useHydratedStore';

// Tokens do tema via CSS var: os gráficos acompanham o claro/escuro sem JS.
const tooltipStyle = {
  background: 'var(--color-base-100)',
  border: '1px solid color-mix(in oklab, var(--color-base-content) 12%, transparent)',
  borderRadius: 12,
  color: 'var(--color-base-content)',
};

// Eixo Y curto para caber no celular: "R$ 1,5 mil", "R$ 12 mil".
const BRL_COMPACT = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  notation: 'compact',
  minimumFractionDigits: 0,
  maximumFractionDigits: 1,
});

export function DashboardCharts() {
  const hydrated = useHydrated();
  const transactions = useFinanceStore((s) => s.transactions);
  const invoices = useFinanceStore((s) => s.creditCardInvoices);
  const { styleOf } = useCategories();

  const cashflow = hydrated
    ? cashflowLastMonths(transactions, 6, invoiceOutflows(invoices).realized)
    : cashflowLastMonths([], 6);
  const categories = hydrated ? expensesByCategory(transactions) : [];

  return (
    <section className="grid gap-4 lg:grid-cols-2">
      <div className="panel p-4">
        <SectionTitle>Fluxo de caixa · 6 meses</SectionTitle>
        <div className="h-56 w-full sm:h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={cashflow} barGap={4}>
              <CartesianGrid vertical={false} strokeOpacity={0.12} />
              <XAxis dataKey="mes" stroke="currentColor" fontSize={12} tickLine={false} axisLine={false} />
              <YAxis
                width="auto"
                stroke="currentColor"
                fontSize={11}
                tickLine={false}
                axisLine={false}
                tickFormatter={(value: number) => BRL_COMPACT.format(value)}
              />
              <Tooltip
                formatter={(value) => BRL.format(Number(value))}
                contentStyle={tooltipStyle}
                cursor={{ fill: 'currentColor', fillOpacity: 0.05 }}
              />
              <Bar dataKey="entradas" name="Entradas" fill={TONE_HEX.emerald} radius={[8, 8, 8, 8]} />
              <Bar dataKey="saidas" name="Saídas" fill={TONE_HEX.pink} radius={[8, 8, 8, 8]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="mt-2 flex gap-4 text-xs font-semibold">
          <Legend color={TONE_HEX.emerald} label="Entradas" />
          <Legend color={TONE_HEX.pink} label="Saídas" />
        </div>
      </div>

      <div className="panel p-4">
        <SectionTitle>Gastos do mês por categoria</SectionTitle>
        {categories.length === 0 ? (
          <div className="text-base-content/60 grid h-56 place-items-center text-center text-sm sm:h-64">
            Lance despesas para ver a divisão por categoria.
          </div>
        ) : (
          <div className="flex flex-col items-center gap-4 sm:flex-row">
            <div className="h-48 w-48 shrink-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={categories}
                    dataKey="value"
                    nameKey="name"
                    outerRadius="100%"
                    innerRadius="60%"
                    paddingAngle={3}
                    cornerRadius={6}
                    stroke="none"
                  >
                    {categories.map((c) => (
                      <Cell key={c.name} fill={TONE_HEX[styleOf(c.name).tone]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => BRL.format(Number(value))} contentStyle={tooltipStyle} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <ul className="w-full space-y-1.5 text-sm">
              {categories.slice(0, 6).map((c) => (
                <li key={c.name} className="flex items-center justify-between gap-2">
                  <Legend color={TONE_HEX[styleOf(c.name).tone]} label={c.name} />
                  <span className="font-bold tabular-nums">{BRL.format(c.value)}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </section>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className="h-3 w-3 rounded-full" style={{ background: color }} aria-hidden />
      {label}
    </span>
  );
}
