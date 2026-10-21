import { formatDate } from '@/lib/format'
import type { LeadSource } from '@/types/domain'
import type { ReportData } from './api'

// ---------------------------------------------------------------------------
// Períodos (datas locais; o fim é exclusivo)
// ---------------------------------------------------------------------------

export const DEFAULT_PERIOD = '90d'

export const periodOptions = [
  { value: '30d', label: 'Últimos 30 dias' },
  { value: 'mes', label: 'Este mês' },
  { value: 'mes-anterior', label: 'Mês passado' },
  { value: 'ano', label: 'Este ano' },
  { value: '12m', label: 'Últimos 12 meses' },
  { value: 'personalizado', label: 'Período personalizado' },
]

export type Period = { from: Date; to: Date; label: string }

const DAY = 86_400_000

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

function addDays(date: Date, days: number) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days)
}

/** "yyyy-MM-dd" → data local (meia-noite), ou null se inválida. */
export function parseDateInput(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) return null
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
  return Number.isNaN(date.getTime()) || date.getDate() !== Number(match[3]) ? null : date
}

export function toDateInput(date: Date) {
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

export function resolvePeriod(preset: string, de: string, ate: string, now: Date = new Date()): Period {
  const today = startOfDay(now)
  const tomorrow = addDays(today, 1)
  let from: Date
  let to = tomorrow

  switch (preset) {
    case '30d':
      from = addDays(today, -29)
      break
    case 'mes':
      from = new Date(today.getFullYear(), today.getMonth(), 1)
      break
    case 'mes-anterior':
      from = new Date(today.getFullYear(), today.getMonth() - 1, 1)
      to = new Date(today.getFullYear(), today.getMonth(), 1)
      break
    case 'ano':
      from = new Date(today.getFullYear(), 0, 1)
      break
    case '12m':
      from = new Date(today.getFullYear(), today.getMonth() - 11, 1)
      break
    case 'personalizado': {
      const start = parseDateInput(de) ?? addDays(today, -89)
      const end = parseDateInput(ate) ?? today
      from = start <= end ? start : end
      to = addDays(start <= end ? end : start, 1)
      break
    }
    default:
      from = addDays(today, -89)
  }

  return { from, to, label: `${formatDate(from)} a ${formatDate(new Date(to.getTime() - DAY / 2))}` }
}

/** Meses ("yyyy-MM") cobertos pelo período, em ordem. */
export function monthsInPeriod(period: Pick<Period, 'from' | 'to'>) {
  const months: string[] = []
  const last = new Date(period.to.getTime() - 1)
  let cursor = new Date(period.from.getFullYear(), period.from.getMonth(), 1)
  while (cursor <= last && months.length < 120) {
    months.push(toDateInput(cursor).slice(0, 7))
    cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1)
  }
  return months
}

const monthFormatter = new Intl.DateTimeFormat('pt-BR', { month: 'short', year: '2-digit' })

/** "2026-10" → "out. 26" */
export function formatMonth(month: string) {
  const [year, value] = month.split('-').map(Number)
  return monthFormatter.format(new Date(year ?? 2000, (value ?? 1) - 1, 1))
}

// ---------------------------------------------------------------------------
// Consolidação dos dados
// ---------------------------------------------------------------------------

/** Percentual (0–100) ou null quando não há base. */
export function percent(part: number, total: number) {
  return total > 0 ? (part / total) * 100 : null
}

export function formatPercent(value: number | null) {
  if (value === null) return '—'
  return `${value.toLocaleString('pt-BR', { maximumFractionDigits: value < 10 ? 1 : 0 })}%`
}

export function formatDays(value: number | null | undefined) {
  if (value === null || value === undefined) return '—'
  const rounded = Number(value)
  if (rounded < 1) return 'menos de 1 dia'
  const text = rounded.toLocaleString('pt-BR', { maximumFractionDigits: rounded < 10 ? 1 : 0 })
  return `${text} ${rounded < 2 ? 'dia' : 'dias'}`
}

export type SourceRow = { source: LeadSource; total: number; won: number; lost: number }

/** Soma as origens dos dois funis, da maior para a menor. */
export function aggregateSources(sources: ReportData['sources']): SourceRow[] {
  const map = new Map<LeadSource, SourceRow>()
  for (const row of sources) {
    const current = map.get(row.source) ?? { source: row.source, total: 0, won: 0, lost: 0 }
    current.total += row.total
    current.won += row.won
    current.lost += row.lost
    map.set(row.source, current)
  }
  return [...map.values()].sort((a, b) => b.total - a.total || a.source.localeCompare(b.source))
}

export type MonthRow = { month: string; label: string; total: number; amount: number }

/** Fechamentos por mês, com zero nos meses sem fechamento. */
export function monthlySeries(monthly: ReportData['monthly'], period: Pick<Period, 'from' | 'to'>): MonthRow[] {
  return monthsInPeriod(period).map((month) => {
    const rows = monthly.filter((row) => row.month === month)
    return {
      month,
      label: formatMonth(month),
      total: rows.reduce((sum, row) => sum + row.total, 0),
      amount: rows.reduce((sum, row) => sum + Number(row.amount), 0),
    }
  })
}

export function reportSummary(data: ReportData) {
  const sources = aggregateSources(data.sources)
  const leads = sources.reduce((sum, row) => sum + row.total, 0)
  const leadsWon = sources.reduce((sum, row) => sum + row.won, 0)
  const { won_count: won, lost_count: lost } = data.deals
  return {
    leads,
    leadsWon,
    leadConversion: percent(leadsWon, leads),
    dealSuccess: percent(won, won + lost),
  }
}
