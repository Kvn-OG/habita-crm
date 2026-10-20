import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ArrowRightLeft, CalendarCheck, CircleDot, Eraser, History, Mail, MessageCircle, Pencil, Phone, StickyNote, Trash2, Users,
} from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { useForm } from 'react-hook-form'
import { useAuth } from '@/auth/AuthContext'
import { EmptyState } from '@/components/feedback/EmptyState'
import { ErrorState } from '@/components/feedback/ErrorState'
import { useToast } from '@/components/feedback/Toast'
import { Select, Textarea } from '@/components/forms/inputs'
import { Button, IconButton } from '@/components/ui/Button'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { Spinner } from '@/components/ui/Feedback'
import { getErrorMessage } from '@/lib/errors'
import { formatDateTime, formatRelative } from '@/lib/format'
import { activityTypeLabels, toOptions } from '@/lib/labels'
import { cn } from '@/lib/utils'
import { MANUAL_ACTIVITY_TYPES, type ActivityType } from '@/types/domain'
import { AUTOMATIC_ACTIVITY_TYPES, isStageRegression, wasEdited } from '../activityRules'
import { createActivity, deleteActivity, deleteAllActivities, leadKeys, listActivities, updateActivity, useStages } from '../api'
import { activitySchema, type ActivityFormValues } from '../schema'
import type { Activity } from '../types'

const icons: Record<ActivityType, ReactNode> = {
  nota: <StickyNote />,
  ligacao: <Phone />,
  whatsapp: <MessageCircle />,
  email: <Mail />,
  visita: <CalendarCheck />,
  reuniao: <Users />,
  mudanca_etapa: <ArrowRightLeft />,
  sistema: <CircleDot />,
}

type ActivityTimelineProps = {
  scope: 'lead' | 'contact'
  id: string
  /** Para registrar atividades de um lead também vinculadas ao contato. */
  contactId?: string
  canAdd?: boolean
}

function EditActivity({ activity, onDone }: { activity: Activity; onDone: () => void }) {
  const queryClient = useQueryClient()
  const toast = useToast()
  const [text, setText] = useState(activity.description)
  const trimmed = text.trim()
  const invalid = trimmed.length === 0 || trimmed.length > 5000

  const save = useMutation({
    mutationFn: () => updateActivity(activity.id, trimmed),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['activities'] })
      await queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      toast.success('Comentário atualizado.')
      onDone()
    },
    onError: (error) => toast.error('Não foi possível salvar a alteração', getErrorMessage(error)),
  })

  return (
    <form
      className="mt-1.5"
      onSubmit={(event) => {
        event.preventDefault()
        if (!invalid) save.mutate()
      }}
    >
      <label htmlFor={`edit-${activity.id}`} className="sr-only">
        Editar comentário
      </label>
      <Textarea
        id={`edit-${activity.id}`}
        rows={3}
        autoFocus
        value={text}
        onChange={(event) => setText(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Escape') onDone()
          if (event.key === 'Enter' && (event.ctrlKey || event.metaKey) && !invalid) save.mutate()
        }}
        aria-invalid={invalid ? true : undefined}
      />
      {trimmed.length === 0 && <p className="mt-1 text-xs font-medium text-danger-700">O comentário não pode ficar vazio.</p>}
      <div className="mt-2 flex items-center gap-2">
        <Button type="submit" size="sm" loading={save.isPending} disabled={invalid || trimmed === activity.description}>
          Salvar
        </Button>
        <Button variant="ghost" size="sm" onClick={onDone} disabled={save.isPending}>
          Cancelar
        </Button>
        <span className="ml-auto hidden text-[11px] text-subtle sm:inline">Ctrl+Enter para salvar · Esc para cancelar</span>
      </div>
    </form>
  )
}

export function ActivityTimeline({ scope, id, contactId, canAdd = true }: ActivityTimelineProps) {
  const queryClient = useQueryClient()
  const toast = useToast()
  const { permissions, profile } = useAuth()
  const stagesQuery = useStages()
  const [toDelete, setToDelete] = useState<Activity | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [confirmClear, setConfirmClear] = useState(false)
  const query = useQuery({ queryKey: leadKeys.activities(scope, id), queryFn: () => listActivities(scope, id) })

  const form = useForm<ActivityFormValues>({
    resolver: zodResolver(activitySchema),
    defaultValues: { activity_type: 'nota', description: '' },
  })

  const invalidate = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: ['activities'] }),
      queryClient.invalidateQueries({ queryKey: ['dashboard'] }),
    ])

  const add = useMutation({
    mutationFn: (values: ActivityFormValues) =>
      createActivity(values, scope === 'lead' ? { leadId: id, contactId } : { contactId: id }),
    onSuccess: async () => {
      await invalidate()
      form.reset({ activity_type: form.getValues('activity_type'), description: '' })
      toast.success('Atividade registrada.')
    },
    onError: (error) => toast.error('Não foi possível registrar a atividade', getErrorMessage(error)),
  })

  const remove = useMutation({
    mutationFn: deleteActivity,
    onSuccess: async () => {
      await invalidate()
      setToDelete(null)
      toast.success('Atividade excluída.')
    },
    onError: (error) => toast.error('Não foi possível excluir', getErrorMessage(error)),
  })

  const isOwnerOrManager = (activity: Activity) => permissions.isManager || activity.created_by === profile?.id
  const canEdit = (activity: Activity) => !AUTOMATIC_ACTIVITY_TYPES.includes(activity.activity_type) && isOwnerOrManager(activity)
  const canDelete = isOwnerOrManager

  const clear = useMutation({
    mutationFn: () => deleteAllActivities(scope, id),
    onSuccess: async (count) => {
      await invalidate()
      setConfirmClear(false)
      toast.success(count === 1 ? '1 registro excluído do histórico.' : `${count} registros excluídos do histórico.`)
    },
    onError: (error) => toast.error('Não foi possível limpar o histórico', getErrorMessage(error)),
  })

  // Retrocessos de etapa não são exibidos (continuam registrados no banco).
  const activities = (query.data ?? []).filter((activity) => !isStageRegression(activity, stagesQuery.data ?? []))

  return (
    <div>
      {canAdd && (
        <form
          className="border-b border-line p-4 sm:p-5"
          onSubmit={(event) => void form.handleSubmit((values) => add.mutate(values))(event)}
          noValidate
        >
          <label htmlFor={`activity-${id}`} className="sr-only">
            Descrição da atividade
          </label>
          <Textarea
            id={`activity-${id}`}
            rows={2}
            placeholder="Registre uma ligação, mensagem ou anotação sobre o atendimento…"
            aria-invalid={form.formState.errors.description ? true : undefined}
            {...form.register('description')}
          />
          {form.formState.errors.description && (
            <p className="mt-1.5 text-xs font-medium text-danger-700">{form.formState.errors.description.message}</p>
          )}
          <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2">
            <div className="w-44">
              <Select aria-label="Tipo de atividade" className="h-8 text-[13px]" {...form.register('activity_type')}>
                {toOptions(activityTypeLabels, MANUAL_ACTIVITY_TYPES).map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
            </div>
            <Button type="submit" size="sm" loading={add.isPending}>
              Registrar
            </Button>
          </div>
        </form>
      )}

      {query.isLoading || stagesQuery.isLoading ? (
        <div className="grid place-items-center py-10">
          <Spinner label="Carregando histórico" />
        </div>
      ) : query.isError ? (
        <ErrorState compact error={query.error} onRetry={() => void query.refetch()} />
      ) : activities.length ? (
        <>
          <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-2.5 sm:px-5">
            <span className="text-xs text-muted">
              {activities.length === 1 ? '1 registro' : `${activities.length} registros`}
            </span>
            {permissions.canDelete && (
              <Button variant="danger-ghost" size="sm" icon={<Eraser />} onClick={() => setConfirmClear(true)}>
                Limpar histórico
              </Button>
            )}
          </div>
        <ol className="px-4 py-4 sm:px-5" aria-label="Histórico de atividades">
          {activities.map((activity, index) => {
            const automatic = AUTOMATIC_ACTIVITY_TYPES.includes(activity.activity_type)
            const last = index === activities.length - 1
            const editing = editingId === activity.id
            return (
              <li key={activity.id} className="group relative flex gap-3 pb-5 last:pb-0">
                {!last && <span className="absolute top-8 bottom-0 left-[15px] w-px bg-line" aria-hidden="true" />}
                <span
                  className={cn(
                    'relative grid size-8 shrink-0 place-items-center rounded-full border [&_svg]:size-3.5',
                    automatic ? 'border-line bg-canvas text-subtle' : 'border-brand-200 bg-brand-50 text-brand-800',
                  )}
                  aria-hidden="true"
                >
                  {icons[activity.activity_type]}
                </span>
                <div className="min-w-0 flex-1 pt-0.5">
                  <div className="flex flex-wrap items-baseline gap-x-2 text-xs">
                    <span className="font-semibold text-ink">{activityTypeLabels[activity.activity_type]}</span>
                    <time dateTime={activity.occurred_at} title={formatDateTime(activity.occurred_at)} className="text-muted">
                      {formatRelative(activity.occurred_at)}
                    </time>
                    {activity.author_name && <span className="text-muted">· {activity.author_name}</span>}
                    {!automatic && wasEdited(activity) && (
                      <span className="text-subtle" title={`Editado em ${formatDateTime(activity.updated_at)}`}>
                        · editado
                      </span>
                    )}
                  </div>
                  {editing ? (
                    <EditActivity activity={activity} onDone={() => setEditingId(null)} />
                  ) : (
                    <p className={cn('mt-1 text-[13px] leading-relaxed whitespace-pre-line', automatic ? 'text-muted' : 'text-ink')}>
                      {activity.description}
                    </p>
                  )}
                </div>
                {canDelete(activity) && !editing && (
                  <div className="flex shrink-0 gap-0.5 opacity-100 transition-opacity sm:opacity-0 sm:group-focus-within:opacity-100 sm:group-hover:opacity-100">
                    {canEdit(activity) && (
                      <IconButton label="Editar comentário" onClick={() => setEditingId(activity.id)}>
                        <Pencil />
                      </IconButton>
                    )}
                    <IconButton label={automatic ? 'Excluir este registro' : 'Excluir atividade'} onClick={() => setToDelete(activity)}>
                      <Trash2 />
                    </IconButton>
                  </div>
                )}
              </li>
            )
          })}
        </ol>
        </>
      ) : (
        <EmptyState
          compact
          icon={<History />}
          title="Nenhuma atividade registrada"
          description="Ligações, mensagens, visitas e avanços de etapa aparecem aqui."
        />
      )}

      <ConfirmDialog
        open={toDelete !== null}
        title="Excluir atividade?"
        description={
          toDelete && AUTOMATIC_ACTIVITY_TYPES.includes(toDelete.activity_type)
            ? 'Este registro automático será removido do histórico permanentemente. A etapa atual do lead não muda.'
            : 'O registro será removido do histórico permanentemente.'
        }
        confirmLabel="Excluir"
        loading={remove.isPending}
        onConfirm={() => toDelete && remove.mutate(toDelete.id)}
        onCancel={() => setToDelete(null)}
      />
      <ConfirmDialog
        open={confirmClear}
        title="Limpar todo o histórico?"
        description={
          scope === 'lead'
            ? 'Todas as anotações, ligações, visitas e mudanças de etapa deste lead serão excluídas permanentemente. O lead e sua etapa atual são mantidos.'
            : 'Todas as atividades registradas para este contato (inclusive as dos seus leads) serão excluídas permanentemente. O contato e os leads são mantidos.'
        }
        confirmLabel="Limpar histórico"
        loading={clear.isPending}
        onConfirm={() => clear.mutate()}
        onCancel={() => setConfirmClear(false)}
      />
    </div>
  )
}
