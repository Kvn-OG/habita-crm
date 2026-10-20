import { Badge, type BadgeTone } from '@/components/ui/Badge'
import { formatCompactCurrency, formatCurrency, formatDate, formatDateTime } from '@/lib/format'
import { pipelineLabels } from '@/lib/labels'
import { cn } from '@/lib/utils'
import type { Pipeline, StageCategory } from '@/types/domain'

const categoryTones: Record<StageCategory, BadgeTone> = {
  aberto: 'neutral',
  negociacao: 'accent',
  ganho: 'success',
  perdido: 'danger',
}

export function LeadStageBadge({ name, category }: { name: string; category: StageCategory }) {
  return (
    <Badge tone={categoryTones[category]} dot>
      {name}
    </Badge>
  )
}

export function PipelineBadge({ pipeline }: { pipeline: Pipeline }) {
  return <Badge tone={pipeline === 'venda' ? 'brand' : 'info'}>{pipelineLabels[pipeline]}</Badge>
}

export function formatBudget(min: number | null, max: number | null, compact = false) {
  const format = compact ? formatCompactCurrency : formatCurrency
  if (min === null && max === null) return null
  if (min !== null && max !== null) return `${format(min)} – ${format(max)}`
  if (min !== null) return `a partir de ${format(min)}`
  return `até ${format(max)}`
}

/** Data do próximo retorno, destacada quando atrasada ou para hoje. */
export function FollowUpDate({ value, className }: { value: string | null; className?: string }) {
  if (!value) return <span className={cn('text-subtle', className)}>—</span>
  const date = new Date(value)
  const now = new Date()
  const overdue = date.getTime() < now.getTime()
  const today = formatDate(date) === formatDate(now)
  const text = formatDateTime(date)
  return (
    <span className={cn('tabular', overdue ? 'font-medium text-danger-700' : today ? 'font-medium text-accent-700' : 'text-ink', className)}>
      {text}
      {overdue && <span className="sr-only"> (atrasado)</span>}
    </span>
  )
}
