import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Building2, CalendarPlus, Check, Lock, Pencil, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '@/auth/AuthContext'
import { EmptyState } from '@/components/feedback/EmptyState'
import { ErrorState } from '@/components/feedback/ErrorState'
import { useToast } from '@/components/feedback/Toast'
import { Button } from '@/components/ui/Button'
import { Card, CardBody, CardHeader } from '@/components/ui/Card'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { DetailItem, DetailList } from '@/components/ui/DetailList'
import { LoadingScreen } from '@/components/ui/Feedback'
import { AppointmentFormModal } from '@/features/calendar/components/AppointmentFormModal'
import { UpcomingAppointments } from '@/features/calendar/components/UpcomingAppointments'
import { PropertyPrice, PropertyStatusBadge } from '@/features/properties/components/PropertyBadges'
import { getErrorMessage } from '@/lib/errors'
import { formatDate, formatPhone } from '@/lib/format'
import { leadSourceLabels } from '@/lib/labels'
import { cn } from '@/lib/utils'
import type { PipelineStage } from '@/types/domain'
import { deleteLead, getLead, leadKeys, moveLeadStage, useStages } from './api'
import { ActivityTimeline } from './components/ActivityTimeline'
import { FollowUpDate, formatBudget, LeadStageBadge, PipelineBadge } from './components/LeadBadges'
import { LeadFormModal } from './components/LeadFormModal'

function StageProgress({
  stages,
  currentId,
  disabled,
  pending,
  onSelect,
}: {
  stages: PipelineStage[]
  currentId: string
  disabled: boolean
  pending: boolean
  onSelect: (stage: PipelineStage) => void
}) {
  const currentIndex = stages.findIndex((stage) => stage.id === currentId)
  return (
    <ol className="flex gap-1 overflow-x-auto pb-1" aria-label="Etapas do funil">
      {stages.map((stage, index) => {
        const current = stage.id === currentId
        const done = currentIndex > index && stage.category !== 'perdido'
        const lost = stage.category === 'perdido'
        return (
          <li key={stage.id} className="min-w-28 flex-1">
            <button
              type="button"
              disabled={disabled || current || pending}
              onClick={() => onSelect(stage)}
              aria-current={current ? 'step' : undefined}
              title={disabled ? 'Somente o responsável ou gestores podem mover este lead' : `Mover para ${stage.name}`}
              className={cn(
                'group w-full text-left disabled:cursor-default',
                !disabled && !current && 'cursor-pointer',
              )}
            >
              <span
                className={cn(
                  'block h-1.5 rounded-full transition-colors',
                  current
                    ? lost
                      ? 'bg-danger-600'
                      : stage.category === 'ganho'
                        ? 'bg-success-700'
                        : 'bg-accent-500'
                    : done
                      ? 'bg-brand-700'
                      : 'bg-line group-enabled:group-hover:bg-line-strong',
                )}
              />
              <span
                className={cn(
                  'mt-1.5 flex items-center gap-1 truncate text-[11px]',
                  current ? 'font-semibold text-ink' : 'text-muted group-enabled:group-hover:text-ink',
                )}
              >
                {done && <Check className="size-3 shrink-0 text-brand-700" aria-hidden="true" />}
                {stage.name}
              </span>
            </button>
          </li>
        )
      })}
    </ol>
  )
}

export function LeadDetailPage() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const toast = useToast()
  const { permissions } = useAuth()
  const [editing, setEditing] = useState(false)
  const [scheduling, setScheduling] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const stagesQuery = useStages()
  const query = useQuery({ queryKey: leadKeys.detail(id), queryFn: () => getLead(id) })

  const invalidateAll = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: leadKeys.all }),
      queryClient.invalidateQueries({ queryKey: ['activities'] }),
      queryClient.invalidateQueries({ queryKey: ['dashboard'] }),
    ])

  const move = useMutation({
    mutationFn: (stage: PipelineStage) => moveLeadStage(id, stage.id),
    onSuccess: async (_data, stage) => {
      await invalidateAll()
      toast.success(`Lead movido para “${stage.name}”.`)
    },
    onError: (error) => toast.error('Não foi possível mover o lead', getErrorMessage(error)),
  })

  const remove = useMutation({
    mutationFn: () => deleteLead(id),
    onSuccess: async () => {
      await invalidateAll()
      toast.success('Lead excluído.')
      navigate('/leads', { replace: true })
    },
    onError: (error) => {
      setConfirmDelete(false)
      toast.error('Não foi possível excluir o lead', getErrorMessage(error))
    },
  })

  if (query.isLoading) return <LoadingScreen label="Carregando lead" />
  if (query.isError || !query.data) {
    return (
      <Card>
        <ErrorState error={query.error} title="Lead não encontrado" onRetry={() => void query.refetch()} />
      </Card>
    )
  }

  const lead = query.data
  const canEdit = permissions.canEditLead(lead)
  const stages = (stagesQuery.data ?? []).filter((stage) => stage.pipeline === lead.purpose && (stage.is_active || stage.id === lead.stage_id))
  const budget = formatBudget(lead.min_budget === null ? null : Number(lead.min_budget), lead.max_budget === null ? null : Number(lead.max_budget))

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <Link to="/leads" className="inline-flex items-center gap-1.5 text-xs font-medium text-muted hover:text-ink">
            <ArrowLeft className="size-3.5" aria-hidden="true" /> Leads
          </Link>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <PipelineBadge pipeline={lead.purpose} />
            <LeadStageBadge name={lead.stage_name} category={lead.stage_category} />
          </div>
          <h2 className="mt-2 text-xl font-semibold tracking-tight text-ink">
            <Link to={`/contatos/${lead.contact_id}`} className="hover:text-brand-800 hover:underline">
              {lead.contact_name}
            </Link>
          </h2>
          <p className="mt-1 text-[13px] text-muted tabular">
            {formatPhone(lead.contact_phone)}
            {lead.contact_email && ` · ${lead.contact_email}`}
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          {permissions.canDelete && (
            <Button variant="danger-ghost" icon={<Trash2 />} onClick={() => setConfirmDelete(true)}>
              Excluir
            </Button>
          )}
          <Button variant="secondary" icon={<CalendarPlus />} onClick={() => setScheduling(true)}>
            Agendar visita
          </Button>
          {canEdit && (
            <Button variant="secondary" icon={<Pencil />} onClick={() => setEditing(true)}>
              Editar
            </Button>
          )}
        </div>
      </div>

      <Card>
        <CardBody className="py-4">
          {stages.length > 0 && (
            <StageProgress stages={stages} currentId={lead.stage_id} disabled={!canEdit} pending={move.isPending} onSelect={(stage) => move.mutate(stage)} />
          )}
          {!canEdit && (
            <p className="mt-3 flex items-center gap-1.5 text-xs text-muted">
              <Lock className="size-3.5" aria-hidden="true" /> Somente o corretor responsável, o autor do lead ou gestores podem alterar este lead.
            </p>
          )}
        </CardBody>
      </Card>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="min-w-0 space-y-5">
          <Card>
            <CardHeader title="Informações do lead" />
            <CardBody>
              <DetailList columns={3}>
                <DetailItem label="Origem">{leadSourceLabels[lead.source]}</DetailItem>
                <DetailItem label="Corretor responsável">{lead.assignee_name ?? 'Sem responsável'}</DetailItem>
                <DetailItem label="Próximo retorno">
                  {lead.next_follow_up_at ? <FollowUpDate value={lead.next_follow_up_at} /> : null}
                </DetailItem>
                <DetailItem label="Faixa de orçamento">{budget}</DetailItem>
                <DetailItem label="Região desejada">{lead.desired_region}</DetailItem>
                <DetailItem label="Criado em">{formatDate(lead.created_at)}</DetailItem>
                {lead.closed_at && <DetailItem label="Encerrado em">{formatDate(lead.closed_at)}</DetailItem>}
                <DetailItem label="Na etapa atual desde">{formatDate(lead.stage_changed_at)}</DetailItem>
              </DetailList>
              {lead.notes && (
                <div className="mt-5 border-t border-line pt-4">
                  <h3 className="text-xs text-muted">Observações</h3>
                  <p className="mt-1 text-[13px] leading-relaxed whitespace-pre-line text-ink">{lead.notes}</p>
                </div>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Imóveis de interesse" description={lead.properties.length ? `${lead.properties.length} imóvel(is) associado(s)` : undefined} />
            {lead.properties.length ? (
              <ul className="divide-y divide-line">
                {lead.properties.map((property) => (
                  <li key={property.id}>
                    <Link to={`/imoveis/${property.id}`} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-5 py-3 transition-colors hover:bg-hover">
                      <span className="font-mono text-xs font-semibold text-brand-800">{property.code}</span>
                      <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-ink">{property.title}</span>
                      <span className="text-[13px] font-medium">
                        <PropertyPrice property={property} />
                      </span>
                      <PropertyStatusBadge status={property.status} />
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState
                compact
                icon={<Building2 />}
                title="Nenhum imóvel associado"
                description="Edite o lead para associar imóveis da carteira."
              />
            )}
          </Card>

          <Card>
            <CardHeader title="Histórico de atividades" />
            <ActivityTimeline scope="lead" id={lead.id} contactId={lead.contact_id} />
          </Card>
        </div>

        <div className="space-y-5">
          <Card>
            <CardHeader title="Próximos compromissos" />
            <UpcomingAppointments leadId={lead.id} />
          </Card>
        </div>
      </div>

      <LeadFormModal open={editing} onClose={() => setEditing(false)} lead={lead} />
      <AppointmentFormModal
        open={scheduling}
        onClose={() => setScheduling(false)}
        defaults={{
          lead: { id: lead.id, label: lead.contact_name, description: formatPhone(lead.contact_phone) },
          contactId: lead.contact_id,
          property: lead.properties[0] ? { id: lead.properties[0].id, label: `${lead.properties[0].code} · ${lead.properties[0].title}` } : undefined,
          title: `Visita com ${lead.contact_name}`,
        }}
      />
      <ConfirmDialog
        open={confirmDelete}
        title="Excluir lead?"
        description={
          <>
            O lead de <strong className="text-ink">{lead.contact_name}</strong> e todo o seu histórico de atividades serão removidos permanentemente. O contato será mantido.
          </>
        }
        confirmLabel="Excluir lead"
        loading={remove.isPending}
        onConfirm={() => remove.mutate()}
        onCancel={() => setConfirmDelete(false)}
      />
    </div>
  )
}
