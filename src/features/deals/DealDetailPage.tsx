import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Ban, Lock, Pencil, Plus, RotateCcw, ThumbsDown, Trash2, Trophy } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '@/auth/AuthContext'
import { ErrorState } from '@/components/feedback/ErrorState'
import { useToast } from '@/components/feedback/Toast'
import { Button } from '@/components/ui/Button'
import { Card, CardBody, CardHeader } from '@/components/ui/Card'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { DetailItem, DetailList } from '@/components/ui/DetailList'
import { LoadingScreen } from '@/components/ui/Feedback'
import { ActivityTimeline } from '@/features/leads/components/ActivityTimeline'
import { PipelineBadge } from '@/features/leads/components/LeadBadges'
import { PropertyStatusBadge } from '@/features/properties/components/PropertyBadges'
import { getErrorMessage } from '@/lib/errors'
import { formatCurrency, formatDate, formatPhone } from '@/lib/format'
import { dealStatusLabels, pipelineLabels } from '@/lib/labels'
import type { DealStatus } from '@/types/domain'
import { DEAL_RELATED_KEYS, dealKeys, deleteDeal, getDeal, setDealStatus } from './api'
import { DealAmount, dealPropertyLabel, DealStatusBadge } from './components/DealBadges'
import { DealFormModal } from './components/DealFormModal'
import { LoseDealModal } from './components/LoseDealModal'
import { ProposalFormModal } from './components/ProposalFormModal'
import { ProposalList } from './components/ProposalList'

type StatusChange = { status: DealStatus; lossReason?: string }

const statusToasts: Record<DealStatus, string> = {
  em_andamento: 'Negociação reaberta.',
  ganho: 'Negociação ganha. Parabéns!',
  perdido: 'Negociação marcada como perdida.',
  cancelado: 'Negociação cancelada.',
}

export function DealDetailPage() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const toast = useToast()
  const { permissions } = useAuth()
  const [editing, setEditing] = useState(false)
  const [proposing, setProposing] = useState(false)
  const [confirming, setConfirming] = useState<'ganho' | 'cancelado' | 'em_andamento' | null>(null)
  const [losing, setLosing] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const query = useQuery({ queryKey: dealKeys.detail(id), queryFn: () => getDeal(id) })

  const invalidateAll = () => Promise.all(DEAL_RELATED_KEYS.map((queryKey) => queryClient.invalidateQueries({ queryKey })))

  const changeStatus = useMutation({
    mutationFn: ({ status, lossReason }: StatusChange) => setDealStatus(id, status, lossReason),
    onSuccess: async (_data, { status }) => {
      setConfirming(null)
      setLosing(false)
      await invalidateAll()
      toast.success(statusToasts[status])
    },
    onError: (error) => toast.error('Não foi possível alterar a situação', getErrorMessage(error)),
  })

  const remove = useMutation({
    mutationFn: () => deleteDeal(id),
    onSuccess: async () => {
      await invalidateAll()
      toast.success('Negociação excluída.')
      navigate('/negociacoes', { replace: true })
    },
    onError: (error) => {
      setConfirmDelete(false)
      toast.error('Não foi possível excluir a negociação', getErrorMessage(error))
    },
  })

  if (query.isLoading) return <LoadingScreen label="Carregando negociação" />
  if (query.isError || !query.data) {
    return (
      <Card>
        <ErrorState error={query.error} title="Negociação não encontrada" onRetry={() => void query.refetch()} />
      </Card>
    )
  }

  const deal = query.data
  const canEdit = permissions.canEditDeal(deal)
  const open = deal.status === 'em_andamento'
  const property = dealPropertyLabel(deal)
  const wonPropertyStatus = deal.deal_type === 'venda' ? 'vendido' : 'alugado'

  const confirmTexts = {
    ganho: {
      title: 'Marcar negociação como ganha?',
      label: 'Marcar como ganha',
      description: (
        <>
          {property ? (
            <>
              O imóvel <strong className="text-ink">{property}</strong> ficará como <strong className="text-ink">{wonPropertyStatus}</strong> e o
            </>
          ) : (
            'O'
          )}{' '}
          lead irá para a etapa de conclusão do funil de {pipelineLabels[deal.deal_type].toLowerCase()}.
          {deal.amount === null && ' A negociação ainda não tem valor definido: edite-a ou aceite uma proposta para que o valor apareça nos relatórios.'}
        </>
      ),
    },
    cancelado: {
      title: 'Cancelar negociação?',
      label: 'Cancelar negociação',
      description: 'Use quando a negociação foi aberta por engano ou deixou de existir sem ser uma perda. Ela pode ser reaberta depois.',
    },
    em_andamento: {
      title: 'Reabrir negociação?',
      label: 'Reabrir',
      description:
        deal.status === 'ganho' && property
          ? `A negociação volta para "em andamento" e o imóvel ${property} volta a ficar em negociação. A etapa do lead não é alterada.`
          : 'A negociação volta para "em andamento".',
    },
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <Link to="/negociacoes" className="inline-flex items-center gap-1.5 text-xs font-medium text-muted hover:text-ink">
            <ArrowLeft className="size-3.5" aria-hidden="true" /> Negociações
          </Link>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <PipelineBadge pipeline={deal.deal_type} />
            <DealStatusBadge status={deal.status} />
          </div>
          <h2 className="mt-2 text-xl font-semibold tracking-tight text-ink">
            <Link to={`/contatos/${deal.contact_id}`} className="hover:text-brand-800 hover:underline">
              {deal.contact_name}
            </Link>
          </h2>
          <p className="mt-1 text-[13px] text-muted tabular">
            {formatPhone(deal.contact_phone)}
            {property && ` · ${property}`}
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          {permissions.canDelete && (
            <Button variant="danger-ghost" icon={<Trash2 />} onClick={() => setConfirmDelete(true)}>
              Excluir
            </Button>
          )}
          {canEdit && (
            <Button variant="secondary" icon={<Pencil />} onClick={() => setEditing(true)}>
              Editar
            </Button>
          )}
        </div>
      </div>

      <Card>
        <CardBody className="flex flex-col gap-4 py-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs text-muted">Valor da negociação</p>
            <p className="mt-0.5 text-2xl font-semibold tracking-tight text-ink">
              <DealAmount deal={deal} />
            </p>
            {!open && (
              <p className="mt-1 text-xs text-muted">
                {dealStatusLabels[deal.status]} em {formatDate(deal.closed_at)}
                {deal.loss_reason && ` · ${deal.loss_reason}`}
              </p>
            )}
          </div>
          {canEdit ? (
            <div className="flex flex-wrap gap-2">
              {open ? (
                <>
                  <Button variant="ghost" icon={<Ban />} onClick={() => setConfirming('cancelado')}>
                    Cancelar
                  </Button>
                  <Button variant="secondary" icon={<ThumbsDown />} onClick={() => setLosing(true)}>
                    Perdida
                  </Button>
                  <Button variant="accent" icon={<Trophy />} onClick={() => setConfirming('ganho')}>
                    Marcar como ganha
                  </Button>
                </>
              ) : (
                <Button variant="secondary" icon={<RotateCcw />} onClick={() => setConfirming('em_andamento')}>
                  Reabrir negociação
                </Button>
              )}
            </div>
          ) : (
            <p className="flex items-center gap-1.5 text-xs text-muted">
              <Lock className="size-3.5" aria-hidden="true" /> Somente o corretor responsável, o autor da negociação ou gestores podem alterá-la.
            </p>
          )}
        </CardBody>
      </Card>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="min-w-0 space-y-5">
          <Card>
            <CardHeader
              title="Propostas"
              description="Propostas e contrapropostas, da mais recente para a mais antiga"
              actions={
                canEdit && open ? (
                  <Button size="sm" variant="secondary" icon={<Plus />} onClick={() => setProposing(true)}>
                    Nova proposta
                  </Button>
                ) : undefined
              }
            />
            <ProposalList dealId={deal.id} canEdit={canEdit} closed={!open} onCreate={() => setProposing(true)} />
          </Card>

          <Card>
            <CardHeader title="Histórico do lead" description="Inclui a abertura, as propostas e o fechamento desta negociação" />
            <ActivityTimeline scope="lead" id={deal.lead_id} contactId={deal.contact_id} />
          </Card>
        </div>

        <div className="space-y-5">
          <Card>
            <CardHeader title="Informações" />
            <CardBody>
              <DetailList columns={1}>
                <DetailItem label="Lead">
                  <Link to={`/leads/${deal.lead_id}`} className="text-brand-800 hover:underline">
                    Ver lead de {deal.contact_name}
                  </Link>
                </DetailItem>
                <DetailItem label="Imóvel">
                  {deal.property_id && property ? (
                    <span className="flex flex-wrap items-center gap-2">
                      <Link to={`/imoveis/${deal.property_id}`} className="text-brand-800 hover:underline">
                        {property}
                      </Link>
                      {deal.property_status && <PropertyStatusBadge status={deal.property_status} />}
                    </span>
                  ) : null}
                </DetailItem>
                <DetailItem label="Corretor responsável">{deal.assignee_name ?? 'Sem responsável'}</DetailItem>
                <DetailItem label="Previsão de fechamento">
                  {deal.expected_close_date ? formatDate(`${deal.expected_close_date}T12:00:00`) : null}
                </DetailItem>
                <DetailItem label="Última proposta">
                  {deal.last_proposal_amount !== null ? formatCurrency(deal.last_proposal_amount) : null}
                </DetailItem>
                <DetailItem label="Aberta em">{formatDate(deal.created_at)}</DetailItem>
              </DetailList>
              {deal.notes && (
                <div className="mt-5 border-t border-line pt-4">
                  <h3 className="text-xs text-muted">Observações</h3>
                  <p className="mt-1 text-[13px] leading-relaxed whitespace-pre-line text-ink">{deal.notes}</p>
                </div>
              )}
            </CardBody>
          </Card>
        </div>
      </div>

      <DealFormModal open={editing} onClose={() => setEditing(false)} deal={deal} />
      <ProposalFormModal
        open={proposing}
        onClose={() => setProposing(false)}
        dealId={deal.id}
        suggestedAmount={deal.last_proposal_amount ?? deal.amount}
      />
      <LoseDealModal
        open={losing}
        loading={changeStatus.isPending}
        onCancel={() => setLosing(false)}
        onConfirm={(lossReason) => changeStatus.mutate({ status: 'perdido', lossReason })}
      />
      {confirming && (
        <ConfirmDialog
          open
          tone="primary"
          title={confirmTexts[confirming].title}
          description={confirmTexts[confirming].description}
          confirmLabel={confirmTexts[confirming].label}
          loading={changeStatus.isPending}
          onConfirm={() => changeStatus.mutate({ status: confirming })}
          onCancel={() => setConfirming(null)}
        />
      )}
      <ConfirmDialog
        open={confirmDelete}
        title="Excluir negociação?"
        description={
          <>
            A negociação de <strong className="text-ink">{deal.contact_name}</strong> e todas as suas propostas serão removidas permanentemente. O lead e o imóvel são mantidos.
          </>
        }
        confirmLabel="Excluir negociação"
        loading={remove.isPending}
        onConfirm={() => remove.mutate()}
        onCancel={() => setConfirmDelete(false)}
      />
    </div>
  )
}
