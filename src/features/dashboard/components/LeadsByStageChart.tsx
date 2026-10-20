import { Bar, BarChart, CartesianGrid, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { formatNumber } from '@/lib/format'
import type { DashboardMetrics } from '../api'

type Row = DashboardMetrics['leads_by_stage'][number]

// Série única: um tom validado (ver --color-chart-1 em styles/index.css).
const BAR_COLOR = '#16805e'
const INK = '#202723'
const MUTED = '#6f7872'
const GRID = '#e4e8e3'

function ChartTooltip({ active, payload }: { active?: boolean; payload?: { payload: Row }[] }) {
  const row = payload?.[0]?.payload
  if (!active || !row) return null
  return (
    <div className="rounded-md border border-line bg-surface px-3 py-2 text-xs shadow-raised">
      <p className="font-medium text-ink">{row.name}</p>
      <p className="mt-0.5 text-muted">
        {formatNumber(row.total)} lead{row.total === 1 ? '' : 's'}
      </p>
    </div>
  )
}

/** Distribuição dos leads pelas etapas de um funil (barras horizontais). */
export default function LeadsByStageChart({ rows }: { rows: Row[] }) {
  const height = Math.max(160, rows.length * 34 + 24)
  return (
    <figure>
      <div style={{ height }} aria-hidden="true">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={rows} layout="vertical" margin={{ top: 4, right: 36, bottom: 4, left: 4 }} barCategoryGap={8}>
            <CartesianGrid horizontal={false} stroke={GRID} strokeDasharray="0" />
            <XAxis type="number" allowDecimals={false} tick={{ fill: MUTED, fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis type="category" dataKey="name" width={124} tick={{ fill: INK, fontSize: 12 }} axisLine={false} tickLine={false} />
            <Tooltip cursor={{ fill: '#f1f3f0' }} content={<ChartTooltip />} />
            <Bar dataKey="total" fill={BAR_COLOR} radius={[0, 4, 4, 0]} maxBarSize={18} isAnimationActive={false}>
              <LabelList dataKey="total" position="right" fill={INK} fontSize={11} formatter={(value: unknown) => formatNumber(Number(value))} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      {/* Alternativa textual ao gráfico */}
      <table className="sr-only">
        <caption>Leads por etapa</caption>
        <thead>
          <tr>
            <th scope="col">Etapa</th>
            <th scope="col">Leads</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.name}>
              <td>{row.name}</td>
              <td>{row.total}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  )
}
