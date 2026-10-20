import { Building2, MapPin, Target, UserRound } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Badge, type BadgeTone } from '@/components/ui/Badge'
import { formatTime } from '@/lib/format'
import { appointmentStatusLabels, appointmentTypeLabels } from '@/lib/labels'
import type { AppointmentStatus, AppointmentType } from '@/types/domain'
import type { Appointment } from '../types'

const typeTones: Record<AppointmentType, BadgeTone> = { visita: 'accent', reuniao: 'brand', outro: 'neutral' }
const statusTones: Record<AppointmentStatus, BadgeTone> = { agendado: 'info', realizado: 'success', cancelado: 'neutral' }

export function AppointmentItem({ appointment, actions, compact = false }: { appointment: Appointment; actions?: ReactNode; compact?: boolean }) {
  const range = appointment.ends_at ? `${formatTime(appointment.starts_at)}–${formatTime(appointment.ends_at)}` : formatTime(appointment.starts_at)
  return (
    <div className="flex gap-4 px-5 py-3.5">
      <div className="w-[88px] shrink-0 pt-0.5 text-[13px] font-semibold text-brand-900 tabular">{range}</div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-[13px] font-medium text-ink">{appointment.title}</p>
          <Badge tone={typeTones[appointment.appointment_type]}>{appointmentTypeLabels[appointment.appointment_type]}</Badge>
          {appointment.status !== 'agendado' && <Badge tone={statusTones[appointment.status]}>{appointmentStatusLabels[appointment.status]}</Badge>}
        </div>
        {!compact && (
          <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
            {appointment.lead && (
              <Link to={`/leads/${appointment.lead.id}`} className="inline-flex items-center gap-1 hover:text-ink hover:underline">
                <Target className="size-3.5" aria-hidden="true" /> {appointment.lead.contacts?.full_name ?? 'Lead'}
              </Link>
            )}
            {appointment.property && (
              <Link to={`/imoveis/${appointment.property.id}`} className="inline-flex items-center gap-1 hover:text-ink hover:underline">
                <Building2 className="size-3.5" aria-hidden="true" /> {appointment.property.code}
              </Link>
            )}
            {appointment.location && (
              <span className="inline-flex items-center gap-1">
                <MapPin className="size-3.5" aria-hidden="true" /> {appointment.location}
              </span>
            )}
            {appointment.assignee && (
              <span className="inline-flex items-center gap-1">
                <UserRound className="size-3.5" aria-hidden="true" /> {appointment.assignee.full_name}
              </span>
            )}
          </div>
        )}
      </div>
      {actions && <div className="flex shrink-0 items-start gap-1">{actions}</div>}
    </div>
  )
}
