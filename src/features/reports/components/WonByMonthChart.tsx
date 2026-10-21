import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { formatCompactCurrency, formatCurrency, formatNumber } from '@/lib/format'
import type { MonthRow } from '../utils'

// Série única: mesmo tom do gráfico do painel (ver --color-chart-1 em styles/index.css).
const BAR_COLOR = '#16805e'
const INK = '#202723'
const MUTED = '#6f7872'
const GRID = '#e4e8e3'

function ChartTooltip({ active, payload }: { active?: boolean; payload?: { payload: MonthRow }[] }) {
  const row = payload?.[0]?.payload
  if (!active || !row) return null
  return (
    <div className="rounded-md border border-line bg-surface px-3 py-2 text-xs shadow-raised">
      <p className="font-medium text-ink">{row.label}</p>
      <p className="mt-0.5 text-muted">
        {formatCurrency(row.amount)} · {formatNumber(row.total)} fechamento{row.total === 1 ? '' : 's'}
      </p>
    </div>
  )
}

/** Valor das negociações ganhas em cada mês do período. */
export default function WonByMonthChart({ rows }: { rows: MonthRow[] }) {
  return (
    <figure>
      <div className="h-64" aria-hidden="true">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={rows} margin={{ top: 8, right: 8, bottom: 4, left: 8 }} barCategoryGap="24%">
            <CartesianGrid vertical={false} stroke={GRID} strokeDasharray="0" />
            <XAxis dataKey="label" tick={{ fill: INK, fontSize: 11 }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
            <YAxis
              width={64}
              tick={{ fill: MUTED, fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(value: number) => formatCompactCurrency(value)}
            />
            <Tooltip cursor={{ fill: '#f1f3f0' }} content={<ChartTooltip />} />
            <Bar dataKey="amount" fill={BAR_COLOR} radius={[4, 4, 0, 0]} maxBarSize={36} isAnimationActive={false} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      {/* Alternativa textual ao gráfico */}
      <table className="sr-only">
        <caption>Negociações ganhas por mês</caption>
        <thead>
          <tr>
            <th scope="col">Mês</th>
            <th scope="col">Fechamentos</th>
            <th scope="col">Valor</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.month}>
              <td>{row.label}</td>
              <td>{row.total}</td>
              <td>{formatCurrency(row.amount)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  )
}
