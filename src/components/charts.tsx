import type { ReactNode } from 'react';
import {
  Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { CHART_COLORS } from '../utils/constants';

const axis = { stroke: '#9ca3af', fontSize: 12 };
const grid = '#9ca3af33';
const tooltipStyle = { borderRadius: 12, border: '1px solid #e5e7eb', fontSize: 13 };

export function ChartBox({ title, children, empty }: { title: string; children: ReactNode; empty?: boolean }) {
  return (
    <div>
      <h3 className="mb-2 text-sm font-semibold text-gray-700 dark:text-gray-300">{title}</h3>
      {empty ? (
        <p className="flex h-40 items-center justify-center rounded-xl bg-gray-50 text-sm text-gray-500 dark:bg-gray-950">Sem dados no período.</p>
      ) : (
        <div className="h-56 w-full sm:h-64" role="img" aria-label={title}>
          {children}
        </div>
      )}
    </div>
  );
}

interface Series {
  key: string;
  name: string;
}

export function BarSeries({
  data, xKey, series, unit = '', stacked = false,
}: { data: object[]; xKey: string; series: Series[]; unit?: string; stacked?: boolean }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 5, right: 8, left: -12, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={grid} />
        <XAxis dataKey={xKey} {...axis} />
        <YAxis {...axis} allowDecimals={false} unit={unit} />
        <Tooltip contentStyle={tooltipStyle} />
        {series.length > 1 && <Legend />}
        {series.map((s, i) => (
          <Bar key={s.key} dataKey={s.key} name={s.name} fill={CHART_COLORS[i % CHART_COLORS.length]} radius={[6, 6, 0, 0]} stackId={stacked ? 'a' : undefined} />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}

export function LineSeries({
  data, xKey, series, formatY, reversed = false,
}: {
  data: object[];
  xKey: string;
  series: Series[];
  formatY?: (v: number) => string;
  /** true => valores menores no topo (ex.: tempos). */
  reversed?: boolean;
}) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data} margin={{ top: 5, right: 12, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={grid} />
        <XAxis dataKey={xKey} {...axis} />
        <YAxis {...axis} reversed={reversed} domain={['auto', 'auto']} tickFormatter={formatY} width={56} />
        <Tooltip contentStyle={tooltipStyle} formatter={(v) => (formatY && typeof v === 'number' ? formatY(v) : v)} />
        {series.length > 1 && <Legend />}
        {series.map((s, i) => (
          <Line key={s.key} type="monotone" dataKey={s.key} name={s.name} stroke={CHART_COLORS[i % CHART_COLORS.length]} strokeWidth={2.5} dot={{ r: 3 }} connectNulls />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}
