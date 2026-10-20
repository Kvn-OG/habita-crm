import { useMutation, useQueryClient, type QueryKey } from '@tanstack/react-query'
import { ArrowRightLeft, CalendarClock, GripVertical, MapPin, Wallet } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '@/auth/AuthContext'
import { useToast } from '@/components/feedback/Toast'
import { Avatar } from '@/components/ui/Avatar'
import { IconButton } from '@/components/ui/Button'
import { MenuItem, Popover } from '@/components/ui/Popover'
import { getErrorMessage } from '@/lib/errors'
import { formatNumber } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { PipelineStage, StageCategory } from '@/types/domain'
import { leadKeys, moveLeadStage } from '../api'
import type { LeadOverview } from '../types'
import { FollowUpDate, formatBudget } from './LeadBadges'

const columnAccent: Record<StageCategory, string> = {
  aberto: 'bg-brand-700',
  negociacao: 'bg-accent-500',
  ganho: 'bg-success-700',
  perdido: 'bg-danger-600',
}

type KanbanData = { rows: LeadOverview[]; count: number }

/**
 * Funil em colunas. Leads podem ser movidos arrastando o cartão
 * ou pelo menu "Mover para" (acessível por teclado e no celular).
 */
export function KanbanBoard({ stages, data, queryKey }: { stages: PipelineStage[]; data: KanbanData; queryKey: QueryKey }) {
  const queryClient = useQueryClient()
  const toast = useToast()
  const { permissions } = useAuth()
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [overStage, setOverStage] = useState<string | null>(null)

  const move = useMutation({
    mutationFn: ({ lead, stage }: { lead: LeadOverview; stage: PipelineStage }) => moveLeadStage(lead.id, stage.id),
    onMutate: async ({ lead, stage }) => {
      await queryClient.cancelQueries({ queryKey })
      const previous = queryClient.getQueryData<KanbanData>(queryKey)
      queryClient.setQueryData<KanbanData>(queryKey, (current) =>
        current
          ? {
              ...current,
              rows: current.rows.map((row) =>
                row.id === lead.id
                  ? { ...row, stage_id: stage.id, stage_name: stage.name, stage_category: stage.category, stage_changed_at: new Date().toISOString() }
                  : row,
              ),
            }
          : current,
      )
      return { previous }
    },
    onError: (error, _variables, context) => {
      if (context?.previous) queryClient.setQueryData(queryKey, context.previous)
      toast.error('Não foi possível mover o lead', getErrorMessage(error))
    },
    onSuccess: (_data, { lead, stage }) => toast.success(`${lead.contact_name} movido para “${stage.name}”.`),
    onSettled: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: leadKeys.all }),
        queryClient.invalidateQueries({ queryKey: ['activities'] }),
        queryClient.invalidateQueries({ queryKey: ['dashboard'] }),
      ])
    },
  })

  const moveTo = (lead: LeadOverview, stage: PipelineStage) => {
    if (lead.stage_id === stage.id) return
    move.mutate({ lead, stage })
  }

  return (
    <div className="-mx-4 overflow-x-auto px-4 pb-3 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
      <div className="flex min-w-max gap-3">
        {stages.map((stage) => {
          const leads = data.rows.filter((lead) => lead.stage_id === stage.id)
          const isOver = overStage === stage.id && draggingId !== null
          return (
            <section
              key={stage.id}
              aria-label={`Etapa ${stage.name}`}
              className={cn(
                'flex max-h-[calc(100dvh-15rem)] w-[272px] shrink-0 flex-col rounded-lg border bg-canvas/70 transition-colors',
                isOver ? 'border-brand-700/50 bg-brand-50' : 'border-line',
              )}
              onDragOver={(event) => {
                if (!draggingId) return
                event.preventDefault()
                event.dataTransfer.dropEffect = 'move'
                setOverStage(stage.id)
              }}
              onDragLeave={(event) => {
                if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOverStage(null)
              }}
              onDrop={(event) => {
                event.preventDefault()
                const lead = data.rows.find((row) => row.id === event.dataTransfer.getData('text/plain'))
                setOverStage(null)
                setDraggingId(null)
                if (lead) moveTo(lead, stage)
              }}
            >
              <header className="flex items-center gap-2 px-3 pt-3 pb-2">
                <span className={cn('size-2 rounded-full', columnAccent[stage.category])} aria-hidden="true" />
                <h3 className="flex-1 truncate text-[13px] font-semibold text-ink">{stage.name}</h3>
                <span className="rounded-sm bg-surface px-1.5 py-px text-[11px] font-medium text-muted tabular ring-1 ring-line">
                  {formatNumber(leads.length)}
                </span>
              </header>
              <ul className="flex min-h-24 flex-1 flex-col gap-2 overflow-y-auto px-2 pb-2">
                {leads.map((lead) => {
                  const editable = permissions.canEditLead(lead)
                  const budget = formatBudget(lead.min_budget === null ? null : Number(lead.min_budget), lead.max_budget === null ? null : Number(lead.max_budget), true)
                  return (
                    <li
                      key={lead.id}
                      draggable={editable}
                      onDragStart={(event) => {
                        event.dataTransfer.setData('text/plain', lead.id)
                        event.dataTransfer.effectAllowed = 'move'
                        setDraggingId(lead.id)
                      }}
                      onDragEnd={() => {
                        setDraggingId(null)
                        setOverStage(null)
                      }}
                      className={cn(
                        'group rounded-md border border-line bg-surface p-3 shadow-card transition-[box-shadow,opacity]',
                        editable && 'cursor-grab hover:shadow-raised active:cursor-grabbing',
                        draggingId === lead.id && 'opacity-50',
                      )}
                    >
                      <div className="flex items-start gap-1.5">
                        {editable && <GripVertical className="mt-0.5 -ml-1 size-3.5 shrink-0 text-line-strong group-hover:text-subtle" aria-hidden="true" />}
                        <Link to={`/leads/${lead.id}`} className="min-w-0 flex-1 text-[13px] leading-snug font-medium text-ink hover:text-brand-800 hover:underline">
                          {lead.contact_name}
                        </Link>
                        {editable && (
                          <Popover
                            align="end"
                            className="w-56"
                            trigger={({ open, toggle, id }) => (
                              <IconButton label={`Mover ${lead.contact_name} para outra etapa`} className="-mt-1 -mr-1.5 size-7" onClick={toggle} aria-expanded={open} aria-controls={id}>
                                <ArrowRightLeft />
                              </IconButton>
                            )}
                          >
                            {(close) => (
                              <div>
                                <p className="px-2.5 pt-1 pb-1.5 text-[11px] font-medium text-muted">Mover para</p>
                                {stages
                                  .filter((target) => target.id !== lead.stage_id)
                                  .map((target) => (
                                    <MenuItem
                                      key={target.id}
                                      icon={<span className={cn('size-2 rounded-full', columnAccent[target.category])} />}
                                      onClick={() => {
                                        close()
                                        moveTo(lead, target)
                                      }}
                                    >
                                      {target.name}
                                    </MenuItem>
                                  ))}
                              </div>
                            )}
                          </Popover>
                        )}
                      </div>
                      <div className="mt-2 space-y-1 text-xs text-muted">
                        {lead.desired_region && (
                          <p className="flex items-center gap-1.5 truncate">
                            <MapPin className="size-3.5 shrink-0" aria-hidden="true" /> {lead.desired_region}
                          </p>
                        )}
                        {budget && (
                          <p className="flex items-center gap-1.5 truncate">
                            <Wallet className="size-3.5 shrink-0" aria-hidden="true" /> {budget}
                          </p>
                        )}
                        {lead.next_follow_up_at && (
                          <p className="flex items-center gap-1.5">
                            <CalendarClock className="size-3.5 shrink-0" aria-hidden="true" />
                            <FollowUpDate value={lead.next_follow_up_at} className="text-xs" />
                          </p>
                        )}
                      </div>
                      <div className="mt-2.5 flex items-center justify-between border-t border-line pt-2">
                        <span className="text-[11px] text-subtle">
                          {lead.property_count > 0 ? `${lead.property_count} imóvel(is)` : 'Sem imóvel associado'}
                        </span>
                        {lead.assignee_name ? (
                          <span title={`Responsável: ${lead.assignee_name}`}>
                            <Avatar name={lead.assignee_name} size="xs" />
                          </span>
                        ) : (
                          <span className="text-[11px] text-subtle">Sem responsável</span>
                        )}
                      </div>
                    </li>
                  )
                })}
                {leads.length === 0 && (
                  <li className="grid flex-1 place-items-center rounded-md border border-dashed border-line-strong/70 px-3 py-6 text-center text-xs text-subtle">
                    Nenhum lead nesta etapa
                  </li>
                )}
              </ul>
            </section>
          )
        })}
      </div>
    </div>
  )
}
