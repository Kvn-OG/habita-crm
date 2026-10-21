import { Badge, type BadgeTone } from '@/components/ui/Badge'
import { formatCurrency } from '@/lib/format'
import { dealStatusLabels, proposalStatusLabels } from '@/lib/labels'
import type { DealStatus, ProposalStatus } from '@/types/domain'
import type { DealOverview } from '../types'

const dealTones: Record<DealStatus, BadgeTone> = {
  em_andamento: 'accent',
  ganho: 'success',
  perdido: 'danger',
  cancelado: 'neutral',
}

const proposalTones: Record<ProposalStatus, BadgeTone> = {
  rascunho: 'neutral',
  enviada: 'info',
  aceita: 'success',
  recusada: 'danger',
  cancelada: 'neutral',
}

export function DealStatusBadge({ status }: { status: DealStatus }) {
  return (
    <Badge tone={dealTones[status]} dot>
      {dealStatusLabels[status]}
    </Badge>
  )
}

export function ProposalStatusBadge({ status }: { status: ProposalStatus }) {
  return <Badge tone={proposalTones[status]}>{proposalStatusLabels[status]}</Badge>
}

/** Valor combinado ou, na falta dele, a última proposta registrada. */
export function DealAmount({ deal }: { deal: Pick<DealOverview, 'amount' | 'last_proposal_amount'> }) {
  if (deal.amount !== null) return <span className="tabular">{formatCurrency(deal.amount)}</span>
  if (deal.last_proposal_amount !== null) {
    return (
      <span className="tabular text-muted" title="Valor da última proposta">
        {formatCurrency(deal.last_proposal_amount)} <span className="text-xs">(proposta)</span>
      </span>
    )
  }
  return <span className="text-subtle">—</span>
}

export function dealPropertyLabel(deal: Pick<DealOverview, 'property_code' | 'property_title'>) {
  return deal.property_code ? `${deal.property_code} · ${deal.property_title}` : null
}
