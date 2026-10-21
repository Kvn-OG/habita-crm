import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Check, FileText, Pencil, Trash2, X } from 'lucide-react'
import { useState } from 'react'
import { useAuth } from '@/auth/AuthContext'
import { EmptyState } from '@/components/feedback/EmptyState'
import { ErrorState } from '@/components/feedback/ErrorState'
import { useToast } from '@/components/feedback/Toast'
import { Button, IconButton } from '@/components/ui/Button'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { TableSkeleton } from '@/components/ui/Feedback'
import { getErrorMessage } from '@/lib/errors'
import { formatCurrency, formatDate, formatDateTime } from '@/lib/format'
import type { ProposalStatus } from '@/types/domain'
import { DEAL_RELATED_KEYS, dealKeys, deleteProposal, listProposals, setProposalStatus } from '../api'
import type { Proposal } from '../types'
import { ProposalStatusBadge } from './DealBadges'
import { ProposalFormModal } from './ProposalFormModal'

type ProposalListProps = {
  dealId: string
  /** Pode registrar e alterar propostas (responsável, autor ou administrador). */
  canEdit: boolean
  /** Negociação encerrada: apenas consulta. */
  closed: boolean
  onCreate: () => void
}

export function ProposalList({ dealId, canEdit, closed, onCreate }: ProposalListProps) {
  const queryClient = useQueryClient()
  const toast = useToast()
  const { permissions } = useAuth()
  const [editing, setEditing] = useState<Proposal | null>(null)
  const [removing, setRemoving] = useState<Proposal | null>(null)
  const query = useQuery({ queryKey: dealKeys.proposals(dealId), queryFn: () => listProposals(dealId) })

  const invalidate = () => Promise.all(DEAL_RELATED_KEYS.map((queryKey) => queryClient.invalidateQueries({ queryKey })))

  const changeStatus = useMutation({
    mutationFn: ({ proposal, status }: { proposal: Proposal; status: ProposalStatus }) => setProposalStatus(proposal.id, status),
    onSuccess: async (_data, { status }) => {
      await invalidate()
      toast.success(status === 'aceita' ? 'Proposta aceita. O valor da negociação foi atualizado.' : 'Proposta recusada.')
    },
    onError: (error) => toast.error('Não foi possível alterar a proposta', getErrorMessage(error)),
  })

  const remove = useMutation({
    mutationFn: (proposal: Proposal) => deleteProposal(proposal.id),
    onSuccess: async () => {
      setRemoving(null)
      await invalidate()
      toast.success('Proposta excluída.')
    },
    onError: (error) => {
      setRemoving(null)
      toast.error('Não foi possível excluir a proposta', getErrorMessage(error))
    },
  })

  if (query.isLoading) return <TableSkeleton rows={2} />
  if (query.isError) return <ErrorState compact error={query.error} onRetry={() => void query.refetch()} />

  const proposals = query.data ?? []
  if (proposals.length === 0) {
    return (
      <EmptyState
        compact
        icon={<FileText />}
        title="Nenhuma proposta registrada"
        description="Registre as propostas e contrapropostas para manter o histórico de valores."
        action={
          canEdit && !closed ? (
            <Button variant="secondary" size="sm" onClick={onCreate}>
              Registrar proposta
            </Button>
          ) : undefined
        }
      />
    )
  }

  const pending = (proposal: Proposal) => changeStatus.isPending && changeStatus.variables?.proposal.id === proposal.id

  return (
    <>
      <ul className="divide-y divide-line">
        {proposals.map((proposal) => {
          const open = proposal.status === 'rascunho' || proposal.status === 'enviada'
          return (
            <li key={proposal.id} className="px-5 py-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[15px] font-semibold text-ink tabular">{formatCurrency(proposal.amount)}</span>
                    <ProposalStatusBadge status={proposal.status} />
                  </div>
                  <p className="mt-0.5 text-xs text-muted">
                    {formatDateTime(proposal.created_at)}
                    {proposal.author_name && ` · ${proposal.author_name}`}
                    {proposal.valid_until && ` · válida até ${formatDate(`${proposal.valid_until}T12:00:00`)}`}
                  </p>
                </div>
                {canEdit && (
                  <div className="flex shrink-0 items-center gap-1">
                    {open && !closed && (
                      <>
                        <Button
                          size="sm"
                          variant="secondary"
                          icon={<Check />}
                          loading={pending(proposal) && changeStatus.variables?.status === 'aceita'}
                          disabled={changeStatus.isPending}
                          onClick={() => changeStatus.mutate({ proposal, status: 'aceita' })}
                        >
                          Aceitar
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          icon={<X />}
                          loading={pending(proposal) && changeStatus.variables?.status === 'recusada'}
                          disabled={changeStatus.isPending}
                          onClick={() => changeStatus.mutate({ proposal, status: 'recusada' })}
                        >
                          Recusar
                        </Button>
                      </>
                    )}
                    <IconButton label="Editar proposta" onClick={() => setEditing(proposal)}>
                      <Pencil />
                    </IconButton>
                    {permissions.canDelete && (
                      <IconButton label="Excluir proposta" variant="danger-ghost" onClick={() => setRemoving(proposal)}>
                        <Trash2 />
                      </IconButton>
                    )}
                  </div>
                )}
              </div>
              {proposal.conditions && <p className="mt-2 text-[13px] leading-relaxed whitespace-pre-line text-ink">{proposal.conditions}</p>}
            </li>
          )
        })}
      </ul>

      <ProposalFormModal open={Boolean(editing)} onClose={() => setEditing(null)} dealId={dealId} proposal={editing} />
      <ConfirmDialog
        open={Boolean(removing)}
        title="Excluir proposta?"
        description={
          <>
            A proposta de <strong className="text-ink">{formatCurrency(removing?.amount)}</strong> será removida permanentemente. O valor da negociação não é alterado.
          </>
        }
        confirmLabel="Excluir proposta"
        loading={remove.isPending}
        onConfirm={() => removing && remove.mutate(removing)}
        onCancel={() => setRemoving(null)}
      />
    </>
  )
}
