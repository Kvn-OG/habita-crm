import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CalendarDays, CalendarPlus, Check, Pencil, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useAuth } from '@/auth/AuthContext'
import { Alert } from '@/components/feedback/Alert'
import { EmptyState } from '@/components/feedback/EmptyState'
import { ErrorState } from '@/components/feedback/ErrorState'
import { useToast } from '@/components/feedback/Toast'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button, IconButton } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { TableSkeleton } from '@/components/ui/Feedback'
import { SegmentedControl } from '@/components/ui/SegmentedControl'
import { getErrorMessage } from '@/lib/errors'
import { formatDate, formatLongDate } from '@/lib/format'
import type { AppointmentStatus } from '@/types/domain'
import { AGENDA_LIMIT, appointmentKeys, listAppointments, setAppointmentStatus } from './api'
import { AppointmentFormModal } from './components/AppointmentFormModal'
import { AppointmentItem } from './components/AppointmentItem'
import type { AgendaView, Appointment } from './types'

function groupByDay(appointments: Appointment[]) {
  const groups = new Map<string, Appointment[]>()
  for (const appointment of appointments) {
    const key = formatDate(appointment.starts_at)
    groups.set(key, [...(groups.get(key) ?? []), appointment])
  }
  return [...groups.entries()]
}

function dayLabel(iso: string) {
  const date = new Date(iso)
  const today = new Date()
  const tomorrow = new Date()
  tomorrow.setDate(today.getDate() + 1)
  if (formatDate(date) === formatDate(today)) return `Hoje · ${formatDate(date)}`
  if (formatDate(date) === formatDate(tomorrow)) return `Amanhã · ${formatDate(date)}`
  return formatLongDate(date)
}

export function AgendaPage() {
  const queryClient = useQueryClient()
  const toast = useToast()
  const { permissions, profile } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const [view, setView] = useState<AgendaView>('proximos')
  const [formOpen, setFormOpen] = useState(() => searchParams.get('novo') === '1')
  const [editing, setEditing] = useState<Appointment | null>(null)
  const [toCancel, setToCancel] = useState<Appointment | null>(null)
  const query = useQuery({ queryKey: appointmentKeys.list(view), queryFn: () => listAppointments(view) })

  useEffect(() => {
    if (searchParams.get('novo') === '1') {
      const next = new URLSearchParams(searchParams)
      next.delete('novo')
      setSearchParams(next, { replace: true })
    }
  }, [searchParams, setSearchParams])

  const status = useMutation({
    mutationFn: ({ id, value }: { id: string; value: AppointmentStatus }) => setAppointmentStatus(id, value),
    onSuccess: async (_data, { value }) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: appointmentKeys.all }),
        queryClient.invalidateQueries({ queryKey: ['dashboard'] }),
        queryClient.invalidateQueries({ queryKey: ['agenda-today'] }),
      ])
      setToCancel(null)
      toast.success(value === 'realizado' ? 'Compromisso marcado como realizado.' : 'Compromisso cancelado.')
    },
    onError: (error) => toast.error('Não foi possível atualizar o compromisso', getErrorMessage(error)),
  })

  const canChange = (appointment: Appointment) =>
    permissions.isManager || appointment.assigned_to === profile?.id || appointment.created_by === profile?.id

  const emptyText: Record<AgendaView, { title: string; description: string }> = {
    proximos: { title: 'Nenhum compromisso agendado', description: 'Agende visitas e reuniões para organizar os próximos atendimentos.' },
    anteriores: { title: 'Nenhum compromisso anterior', description: 'Compromissos passados aparecem aqui.' },
    cancelados: { title: 'Nenhum compromisso cancelado', description: 'Compromissos cancelados aparecem aqui.' },
  }

  return (
    <>
      <PageHeader
        description="Visitas e reuniões da equipe, em ordem cronológica."
        actions={
          <Button icon={<CalendarPlus />} onClick={() => setFormOpen(true)}>
            Agendar visita
          </Button>
        }
      />

      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line p-4">
          <SegmentedControl
            label="Período"
            value={view}
            onChange={setView}
            options={[
              { value: 'proximos', label: 'Próximos' },
              { value: 'anteriores', label: 'Anteriores' },
              { value: 'cancelados', label: 'Cancelados' },
            ]}
          />
          <p className="text-xs text-muted">Horários no fuso de Brasília (24 horas).</p>
        </div>

        {query.isLoading ? (
          <TableSkeleton rows={4} />
        ) : query.isError ? (
          <ErrorState error={query.error} onRetry={() => void query.refetch()} />
        ) : query.data?.length ? (
          <div>
            {query.data.length >= AGENDA_LIMIT && (
              <Alert tone="info" className="m-4">
                Exibindo os {AGENDA_LIMIT} compromissos mais próximos deste período.
              </Alert>
            )}
            {groupByDay(query.data).map(([day, items]) => (
              <section key={day} aria-label={day}>
                <h3 className="sticky top-16 z-10 border-b border-line bg-canvas/95 px-5 py-2 text-xs font-semibold text-muted backdrop-blur">
                  {dayLabel(items[0]?.starts_at ?? '')}
                </h3>
                <ul className="divide-y divide-line">
                  {items.map((appointment) => (
                    <li key={appointment.id}>
                      <AppointmentItem
                        appointment={appointment}
                        actions={
                          appointment.status === 'agendado' && canChange(appointment) ? (
                            <>
                              <IconButton label="Marcar como realizado" onClick={() => status.mutate({ id: appointment.id, value: 'realizado' })} disabled={status.isPending}>
                                <Check />
                              </IconButton>
                              <IconButton label="Editar compromisso" onClick={() => setEditing(appointment)}>
                                <Pencil />
                              </IconButton>
                              <IconButton label="Cancelar compromisso" className="hover:text-danger-700" onClick={() => setToCancel(appointment)}>
                                <X />
                              </IconButton>
                            </>
                          ) : undefined
                        }
                      />
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        ) : (
          <EmptyState
            icon={<CalendarDays />}
            title={emptyText[view].title}
            description={emptyText[view].description}
            action={
              view === 'proximos' && (
                <Button icon={<CalendarPlus />} onClick={() => setFormOpen(true)}>
                  Agendar visita
                </Button>
              )
            }
          />
        )}
      </Card>

      <AppointmentFormModal open={formOpen} onClose={() => setFormOpen(false)} />
      <AppointmentFormModal open={editing !== null} onClose={() => setEditing(null)} appointment={editing} />
      <ConfirmDialog
        open={toCancel !== null}
        title="Cancelar compromisso?"
        description={<>O compromisso <strong className="text-ink">{toCancel?.title}</strong> será marcado como cancelado e sairá da lista de próximos.</>}
        confirmLabel="Cancelar compromisso"
        cancelLabel="Voltar"
        loading={status.isPending}
        onConfirm={() => toCancel && status.mutate({ id: toCancel.id, value: 'cancelado' })}
        onCancel={() => setToCancel(null)}
      />
    </>
  )
}
