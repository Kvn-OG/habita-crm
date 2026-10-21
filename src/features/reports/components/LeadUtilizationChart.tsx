import { Bar, BarChart, CartesianGrid, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { formatNumber } from '@/lib/format'
import type { ReportData } from '../api'
import { formatPercent, percent } from '../utils'

// Paleta validada (dataviz/validate_palette, superfície #ffffff): verde da marca, azul e laranja.
const SERIES = [
  { key: 'leads_won', label: 'Concluídos', color: '#16805e' },
  { key: 'leads_open', label: 'Em andamento', color: '#2a78d6' },
  { key: 'leads_lost', label: 'Perdidos', color: '#eb6834' },
] as const
const SURFACE = '#ffffff'
const INK = '#202723'
const MUTED = '#6f7872'
const GRID = '#e4e8e3'

type Row = ReportData['brokers'][number] & { name: string; conversion: number | null }

function ChartTooltip({ active, payload }: { active?: boolean; payload?: { payload: Row }[] }) {
  const row = payload?.[0]?.payload
  if (!active || !row) return null
  return (
    <div className="rounded-md border border-line bg-surface px-3 py-2 text-xs shadow-raised">
      <p className="font-medium text-ink">{row.name}</p>
      <p className="mt-0.5 text-muted">{formatNumber(row.leads)} lead(s) recebido(s) · aproveitamento {formatPercent(row.conversion)}</p>
      <ul className="mt-1.5 space-y-0.5">
        {SERIES.map((series) => (
          <li key={series.key} className="flex items-center gap-2 text-ink">
            <span className="size-2 rounded-full" style={{ background: series.color }} aria-hidden="true" />
            {series.label}: <span className="font-medium tabular">{formatNumber(row[series.key])}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

/**
 * Aproveitamento dos leads recebidos no período por corretor: quantos foram concluídos,
 * seguem em andamento ou foram perdidos. O rótulo no fim da barra é a taxa de conversão.
 */
export default function LeadUtilizationChart({ brokers }: { brokers: ReportData['brokers'] }) {
  const rows: Row[] = brokers
    .filter((broker) => broker.leads > 0)
    .map((broker) => ({ ...broker, name: broker.full_name || 'Sem nome', conversion: percent(broker.leads_won, broker.leads) }))
    .sort((a, b) => (b.conversion ?? 0) - (a.conversion ?? 0) || b.leads - a.leads)

  return (
    <figure>
      <ul className="mb-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted" aria-hidden="true">
        {SERIES.map((series) => (
          <li key={series.key} className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-sm" style={{ background: series.color }} />
            {series.label}
          </li>
        ))}
      </ul>
      <div style={{ height: Math.max(120, rows.length * 44 + 32) }} aria-hidden="true">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={rows} layout="vertical" margin={{ top: 0, right: 56, bottom: 0, left: 0 }} barCategoryGap="28%">
            <CartesianGrid horizontal={false} stroke={GRID} />
            <XAxis type="number" allowDecimals={false} tick={{ fill: MUTED, fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis type="category" dataKey="name" width={120} tick={{ fill: INK, fontSize: 12 }} axisLine={false} tickLine={false} />
            <Tooltip cursor={{ fill: '#f1f3f0' }} content={<ChartTooltip />} />
            {SERIES.map((series, index) => (
              <Bar
                key={series.key}
                dataKey={series.key}
                stackId="leads"
                fill={series.color}
                stroke={SURFACE}
                strokeWidth={2}
                maxBarSize={22}
                radius={index === SERIES.length - 1 ? [0, 4, 4, 0] : 0}
                isAnimationActive={false}
              >
                {index === SERIES.length - 1 && (
                  <LabelList
                    dataKey="conversion"
                    position="right"
                    formatter={(value: unknown) => formatPercent(typeof value === 'number' ? value : null)}
                    style={{ fill: INK, fontSize: 12, fontWeight: 600 }}
                  />
                )}
              </Bar>
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
      {/* Alternativa textual ao gráfico */}
      <table className="sr-only">
        <caption>Aproveitamento de leads por corretor</caption>
        <thead>
          <tr>
            <th scope="col">Corretor</th>
            <th scope="col">Recebidos</th>
            {SERIES.map((series) => (
              <th key={series.key} scope="col">{series.label}</th>
            ))}
            <th scope="col">Aproveitamento</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              <td>{row.name}</td>
              <td>{row.leads}</td>
              {SERIES.map((series) => (
                <td key={series.key}>{row[series.key]}</td>
              ))}
              <td>{formatPercent(row.conversion)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  )
}
