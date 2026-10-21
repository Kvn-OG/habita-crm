import { useQuery } from '@tanstack/react-query'
import { Handshake, Plus } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { EmptyState } from '@/components/feedback/EmptyState'
import { ErrorState } from '@/components/feedback/ErrorState'
import type { PickerOption } from '@/components/forms/AsyncPicker'
import { Button } from '@/components/ui/Button'
import { Card, CardHeader } from '@/components/ui/Card'
import { TableSkeleton } from '@/components/ui/Feedback'
import { dealKeys, listLeadDeals } from '../api'
import { DealAmount, dealPropertyLabel, DealStatusBadge } from './DealBadges'
import { DealFormModal } from './DealFormModal'

type LeadDealsProps = {
  leadId: string
  /** Lead em andamento: permite abrir uma nova negociação. */
  canOpen: boolean
  lead: PickerOption
  defaultProperty?: PickerOption
}

/** Negociações de um lead (página de detalhes do lead). */
export function LeadDeals({ leadId, canOpen, lead, defaultProperty }: LeadDealsProps) {
  const navigate = useNavigate()
  const [creating, setCreating] = useState(false)
  const query = useQuery({ queryKey: dealKeys.byLead(leadId), queryFn: () => listLeadDeals(leadId) })

  return (
    <Card>
      <CardHeader
        title="Negociações"
        actions={
          canOpen && query.data?.length ? (
            <Button size="sm" variant="secondary" icon={<Plus />} onClick={() => setCreating(true)}>
              Abrir
            </Button>
          ) : undefined
        }
      />
      {query.isLoading ? (
        <TableSkeleton rows={1} />
      ) : query.isError ? (
        <ErrorState compact error={query.error} onRetry={() => void query.refetch()} />
      ) : query.data?.length ? (
        <ul className="divide-y divide-line">
          {query.data.map((deal) => (
            <li key={deal.id}>
              <Link to={`/negociacoes/${deal.id}`} className="block px-5 py-3 transition-colors hover:bg-hover">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-[13px] font-medium text-ink">
                    <DealAmount deal={deal} />
                  </span>
                  <DealStatusBadge status={deal.status} />
                </div>
                <p className="mt-0.5 truncate text-xs text-muted">{dealPropertyLabel(deal) ?? 'Sem imóvel definido'}</p>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState
          compact
          icon={<Handshake />}
          title="Nenhuma negociação"
          description="Abra uma negociação para registrar propostas, valores e o fechamento."
          action={
            canOpen ? (
              <Button size="sm" variant="secondary" icon={<Plus />} onClick={() => setCreating(true)}>
                Abrir negociação
              </Button>
            ) : undefined
          }
        />
      )}
      <DealFormModal
        open={creating}
        onClose={() => setCreating(false)}
        defaultLead={lead}
        defaultProperty={defaultProperty}
        onSaved={(id) => navigate(`/negociacoes/${id}`)}
      />
    </Card>
  )
}
