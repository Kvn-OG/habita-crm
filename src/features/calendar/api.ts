import { getSupabase } from '@/lib/supabase'
import type { AppointmentStatus } from '@/types/domain'
import type { AppointmentFormValues } from './schema'
import { toAppointmentPayload } from './schema'
import type { AgendaView, Appointment } from './types'

export const AGENDA_LIMIT = 100

export const appointmentKeys = {
  all: ['appointments'] as const,
  list: (view: AgendaView) => ['appointments', 'list', view] as const,
  upcomingForLead: (leadId: string) => ['appointments', 'lead', leadId] as const,
}

const COLUMNS =
  'id,appointment_type,status,title,starts_at,ends_at,location,notes,lead_id,contact_id,property_id,assigned_to,created_by,' +
  'lead:leads(id, contacts(full_name)), property:properties(id,code,title), assignee:profiles!appointments_assigned_to_fkey(full_name)'

export async function listAppointments(view: AgendaView): Promise<Appointment[]> {
  const now = new Date().toISOString()
  let query = getSupabase().from('appointments').select(COLUMNS)
  if (view === 'proximos') {
    query = query.eq('status', 'agendado').gte('starts_at', now).order('starts_at', { ascending: true })
  } else if (view === 'anteriores') {
    query = query.neq('status', 'cancelado').lt('starts_at', now).order('starts_at', { ascending: false })
  } else {
    query = query.eq('status', 'cancelado').order('starts_at', { ascending: false })
  }
  const { data, error } = await query.limit(AGENDA_LIMIT)
  if (error) throw error
  return (data ?? []) as unknown as Appointment[]
}

export async function listUpcomingForLead(leadId: string): Promise<Appointment[]> {
  const { data, error } = await getSupabase()
    .from('appointments')
    .select(COLUMNS)
    .eq('lead_id', leadId)
    .eq('status', 'agendado')
    .gte('starts_at', new Date().toISOString())
    .order('starts_at')
    .limit(10)
  if (error) throw error
  return (data ?? []) as unknown as Appointment[]
}

async function resolveContactId(leadId: string, fallback: string | null) {
  if (!leadId) return fallback
  const { data, error } = await getSupabase().from('leads').select('contact_id').eq('id', leadId).single()
  if (error) throw error
  return (data as { contact_id: string }).contact_id
}

export async function createAppointment(values: AppointmentFormValues, contactId: string | null) {
  const resolved = await resolveContactId(values.lead_id, contactId)
  const { error } = await getSupabase().from('appointments').insert(toAppointmentPayload(values, resolved))
  if (error) throw error
}

export async function updateAppointment(id: string, values: AppointmentFormValues, contactId: string | null) {
  const resolved = await resolveContactId(values.lead_id, contactId)
  const { error, count } = await getSupabase()
    .from('appointments')
    .update(toAppointmentPayload(values, resolved), { count: 'exact' })
    .eq('id', id)
  if (error) throw error
  if (count === 0) throw new Error('Você só pode alterar compromissos sob sua responsabilidade.')
}

export async function setAppointmentStatus(id: string, status: AppointmentStatus) {
  const { error, count } = await getSupabase().from('appointments').update({ status }, { count: 'exact' }).eq('id', id)
  if (error) throw error
  if (count === 0) throw new Error('Você só pode alterar compromissos sob sua responsabilidade.')
}
