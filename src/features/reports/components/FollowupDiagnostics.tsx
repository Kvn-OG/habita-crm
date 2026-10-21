import { useQuery } from '@tanstack/react-query'
import { ChevronDown, CircleAlert, CircleCheck, CircleDashed, TriangleAlert } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ErrorState } from '@/components/feedback/ErrorState'
import { Badge, type BadgeTone } from '@/components/ui/Badge'
import { TableSkeleton } from '@/components/ui/Feedback'
import { formatDate, formatNumber, formatRelative } from '@/lib/format'
import { pipelineLabels } from '@/lib/labels'
import { cn } from '@/lib/utils'
import { fetchFollowup, reportKeys, type FollowupBroker } from '../api'
import { formatDays, formatPercent, percent } from '../utils'

type Health = { label: string; tone: BadgeTone; icon: ReactNode; tip: string }

/**
 * Situação do acompanhamento: proporção de leads em andamento com retorno atrasado
 * ou sem próximo retorno marcado, e leads sem contato registrado há muitos dias.
 */
function followupHealth(broker: Pick<FollowupBroker, 'active' | 'overdue' | 'no_followup' | 'stale'>): Health {
  if (broker.active === 0) {
    return { label: 'Sem leads ativos', tone: 'neutral', icon: <CircleDashed />, tip: 'Nenhum lead em andamento no momento.' }
  }
  const pending = (broker.overdue + broker.no_followup) / broker.active
  const stale = broker.stale / broker.active
  if (pending <= 0.1 && stale <= 0.1) {
    return { label: 'Em dia', tone: 'success', icon: <CircleCheck />, tip: 'Quase todos os leads têm retorno marcado e contato recente.' }
  }
  if (pending <= 0.3 && stale <= 0.3) {
    return { label: 'Atenção', tone: 'warning', icon: <TriangleAlert />, tip: 'Parte dos leads está sem retorno marcado ou com retorno vencido.' }
  }
  return { label: 'Crítico', tone: 'danger', icon: <CircleAlert />, tip: 'Muitos leads sem acompanhamento: risco de perder oportunidades.' }
}

function Count({ value, total, warn }: { value: number; total: number; warn?: boolean }) {
  const share = percent(value, total)
  return (
    <td className="px-3 py-2.5 text-right tabular">
      <span className={cn(warn && value > 0 ? 'font-semibold text-danger-700' : 'text-ink')}>{formatNumber(value)}</span>
      {total > 0 && value > 0 && <span className="block text-[11px] text-muted">{formatPercent(share)}</span>}
    </td>
  )
}

function BrokerRow({ broker, staleDays }: { broker: FollowupBroker; staleDays: number }) {
  const [open, setOpen] = useState(false)
  const health = followupHealth(broker)
  const name = broker.id === null ? 'Sem responsável' : broker.full_name || 'Sem nome'
  return (
    <>
      <tr className="align-top">
        <td className="px-5 py-2.5">
          <button
            type="button"
            className="flex items-center gap-1.5 text-left font-medium text-ink disabled:cursor-default"
            onClick={() => setOpen((value) => !value)}
            disabled={broker.attention.length === 0}
            aria-expanded={open}
          >
            {broker.attention.length > 0 && <ChevronDown className={cn('size-4 shrink-0 text-subtle transition-transform', open && 'rotate-180')} aria-hidden="true" />}
            {name}
          </button>
        </td>
        <td className="px-3 py-2.5">
          <span title={health.tip}>
            <Badge tone={health.tone} className="[&_svg]:size-3.5">
              {health.icon}
              {health.label}
            </Badge>
          </span>
        </td>
        <td className="px-3 py-2.5 text-right text-ink tabular">{formatNumber(broker.active)}</td>
        <Count value={broker.overdue} total={broker.active} warn />
        <Count value={broker.no_followup} total={broker.active} warn />
        <Count value={broker.due_today} total={broker.active} />
        <Count value={broker.stale} total={broker.active} warn />
        <td className="px-5 py-2.5 text-right text-ink tabular">{broker.active ? formatDays(broker.avg_days_since_touch) : '—'}</td>
      </tr>
      {open && (
        <tr>
          <td colSpan={8} className="bg-canvas/60 px-5 pt-1 pb-3">
            <p className="mb-1.5 text-xs font-medium text-muted">Leads que mais precisam de atenção</p>
            <ul className="divide-y divide-line rounded-md border border-line bg-surface">
              {broker.attention.map((lead) => {
                const overdue = lead.next_follow_up_at !== null && new Date(lead.next_follow_up_at) < new Date()
                return (
                  <li key={lead.id}>
                    <Link to={`/leads/${lead.id}`} className="flex flex-wrap items-center gap-x-3 gap-y-0.5 px-3 py-2 text-[13px] transition-colors hover:bg-hover">
                      <span className="font-medium text-ink">{lead.contact_name}</span>
                      <span className="text-xs text-muted">
                        {pipelineLabels[lead.purpose]} · {lead.stage_name}
                      </span>
                      <span className="ml-auto text-xs text-muted">
                        Último contato {formatRelative(lead.last_touch_at)} ·{' '}
                        {lead.next_follow_up_at === null ? (
                          <span className="font-medium text-danger-700">sem retorno marcado</span>
                        ) : overdue ? (
                          <span className="font-medium text-danger-700">retorno vencido em {formatDate(lead.next_follow_up_at)}</span>
                        ) : (
                          `retorno em ${formatDate(lead.next_follow_up_at)}`
                        )}
                      </span>
                    </Link>
                  </li>
                )
              })}
            </ul>
            {broker.stale > 0 && <p className="mt-1.5 text-[11px] text-subtle">Sem contato = nenhuma ligação, mensagem, e-mail, anotação ou visita registrada há mais de {staleDays} dias.</p>}
          </td>
        </tr>
      )}
    </>
  )
}

/** Diagnóstico de follow-up por corretor: retrato de agora, não depende do período. */
export function FollowupDiagnostics() {
  const query = useQuery({ queryKey: reportKeys.followup, queryFn: fetchFollowup })

  if (query.isLoading) return <TableSkeleton rows={3} />
  if (query.isError) return <ErrorState compact error={query.error} onRetry={() => void query.refetch()} />
  const data = query.data
  if (!data || data.brokers.length === 0) {
    return <p className="px-5 py-8 text-center text-[13px] text-muted">Nenhum corretor ativo nem lead em andamento.</p>
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[760px] text-left text-[13px]">
        <caption className="sr-only">Diagnóstico de follow-up por corretor</caption>
        <thead>
          <tr className="border-b border-line bg-canvas/70 text-xs text-muted">
            <th scope="col" className="h-9 px-5 font-medium">Corretor</th>
            <th scope="col" className="h-9 px-3 font-medium">Situação</th>
            <th scope="col" className="h-9 px-3 text-right font-medium">Leads ativos</th>
            <th scope="col" className="h-9 px-3 text-right font-medium">Retorno vencido</th>
            <th scope="col" className="h-9 px-3 text-right font-medium">Sem retorno marcado</th>
            <th scope="col" className="h-9 px-3 text-right font-medium">Retorno hoje</th>
            <th scope="col" className="h-9 px-3 text-right font-medium">Sem contato há +{data.stale_days} dias</th>
            <th scope="col" className="h-9 px-5 text-right font-medium">Tempo médio sem contato</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {data.brokers.map((broker) => (
            <BrokerRow key={broker.id ?? 'sem-responsavel'} broker={broker} staleDays={data.stale_days} />
          ))}
        </tbody>
      </table>
    </div>
  )
}
