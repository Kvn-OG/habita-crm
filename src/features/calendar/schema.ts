import { nullIfBlank } from '@/lib/utils'
import { optionalText, requiredText, z } from '@/lib/validations'
import { APPOINTMENT_TYPES } from '@/types/domain'
import type { Appointment } from './types'

export const DURATION_OPTIONS = [
  { value: '30', label: '30 minutos' },
  { value: '60', label: '1 hora' },
  { value: '90', label: '1 hora e 30 minutos' },
  { value: '120', label: '2 horas' },
  { value: '180', label: '3 horas' },
]

export function appointmentSchema(isNew: boolean) {
  return z
    .object({
      appointment_type: z.enum(APPOINTMENT_TYPES),
      title: requiredText('o título', 2, 200),
      date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Informe a data.'),
      time: z.string().regex(/^\d{2}:\d{2}$/, 'Informe o horário (24 horas).'),
      duration: z.string(),
      location: optionalText(300, 'O local'),
      notes: optionalText(5000, 'As observações'),
      assigned_to: z.string(),
      lead_id: z.string(),
      property_id: z.string(),
    })
    .superRefine((values, ctx) => {
      if (!isNew) return
      const start = new Date(`${values.date}T${values.time}`)
      if (!Number.isNaN(start.getTime()) && start.getTime() < Date.now() - 5 * 60_000) {
        ctx.addIssue({ code: 'custom', path: ['time'], message: 'Escolha uma data e um horário futuros.' })
      }
    })
}

export type AppointmentFormValues = z.infer<ReturnType<typeof appointmentSchema>>

function pad(value: number) {
  return String(value).padStart(2, '0')
}

/** Data/hora local para os inputs nativos date/time. */
export function splitLocal(iso: string) {
  const date = new Date(iso)
  return {
    date: `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`,
    time: `${pad(date.getHours())}:${pad(date.getMinutes())}`,
  }
}

/** Próximo horário cheio, a partir de amanhã às 10:00 se já passou das 18:00. */
export function suggestedStart() {
  const now = new Date()
  const next = new Date(now)
  next.setMinutes(0, 0, 0)
  next.setHours(now.getHours() + 1)
  if (next.getHours() >= 19 || next.getHours() < 8) {
    if (next.getHours() >= 19) next.setDate(next.getDate() + 1)
    next.setHours(10)
  }
  return splitLocal(next.toISOString())
}

export function appointmentToFormValues(appointment: Appointment): AppointmentFormValues {
  const { date, time } = splitLocal(appointment.starts_at)
  const minutes = appointment.ends_at
    ? Math.round((new Date(appointment.ends_at).getTime() - new Date(appointment.starts_at).getTime()) / 60_000)
    : 60
  return {
    appointment_type: appointment.appointment_type,
    title: appointment.title,
    date,
    time,
    duration: DURATION_OPTIONS.some((option) => option.value === String(minutes)) ? String(minutes) : '60',
    location: appointment.location ?? '',
    notes: appointment.notes ?? '',
    assigned_to: appointment.assigned_to ?? '',
    lead_id: appointment.lead_id ?? '',
    property_id: appointment.property_id ?? '',
  }
}

export function toAppointmentPayload(values: AppointmentFormValues, contactId: string | null) {
  const start = new Date(`${values.date}T${values.time}`)
  const end = new Date(start.getTime() + Number(values.duration || 60) * 60_000)
  return {
    appointment_type: values.appointment_type,
    title: values.title.trim(),
    starts_at: start.toISOString(),
    ends_at: end.toISOString(),
    location: nullIfBlank(values.location),
    notes: nullIfBlank(values.notes),
    assigned_to: values.assigned_to || null,
    lead_id: values.lead_id || null,
    property_id: values.property_id || null,
    contact_id: contactId,
  }
}
