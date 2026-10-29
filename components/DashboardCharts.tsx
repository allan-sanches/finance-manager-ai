'use client';

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { BRL, cashflowLastMonths, expensesByCategory } from '@/lib/finance';
import { useFinanceStore } from '@/lib/store';
import { useHydrated } from '@/lib/useHydratedStore';

const COLORS = ['#22d3ee', '#a78bfa', '#f472b6', '#facc15', '#34d399', '#fb923c', '#60a5fa'];

export function DashboardCharts() {
  const hydrated = useHydrated();
  const transactions = useFinanceStore((s) => s.transactions);

  const cashflow = hydrated
    ? cashflowLastMonths(transactions, 6)
    : cashflowLastMonths([], 6);
  const categorias = hydrated ? expensesByCategory(transactions) : [];
  const hasCategories = categorias.length > 0;

  return (
    <section className="grid gap-4 lg:grid-cols-2">
      <div className="card bg-base-200 shadow">
        <div className="card-body">
          <h2 className="card-title">Fluxo de caixa</h2>
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={cashflow}>
                <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.15} />
                <XAxis dataKey="mes" stroke="currentColor" fontSize={12} />
                <YAxis stroke="currentColor" fontSize={12} tickFormatter={(v) => `R$${v}`} />
                <Tooltip
                  formatter={(value) => BRL.format(Number(value))}
                  contentStyle={{
                    background: 'oklch(var(--b1, var(--color-base-100)))',
                    border: '1px solid oklch(var(--b3, var(--color-base-300)))',
                    borderRadius: 8,
                  }}
                />
                <Legend />
                <Bar dataKey="entradas" name="Entradas" fill="#22c55e" radius={[6, 6, 0, 0]} />
                <Bar dataKey="saidas" name="Saídas" fill="#ef4444" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="card bg-base-200 shadow">
        <div className="card-body">
          <h2 className="card-title">Gastos por categoria</h2>
          <div className="h-72 w-full">
            {hasCategories ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={categorias}
                    dataKey="value"
                    nameKey="name"
                    outerRadius={90}
                    innerRadius={50}
                    paddingAngle={2}
                  >
                    {categorias.map((entry, index) => (
                      <Cell key={entry.name} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value) => BRL.format(Number(value))}
                    contentStyle={{
                      background: 'oklch(var(--b1, var(--color-base-100)))',
                      border: '1px solid oklch(var(--b3, var(--color-base-300)))',
                      borderRadius: 8,
                    }}
                  />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="text-base-content/60 grid h-full place-items-center text-sm">
                <p>Lance despesas para visualizar o gráfico por categoria.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
