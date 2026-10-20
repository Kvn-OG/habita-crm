import type { AppointmentStatus, AppointmentType } from '@/types/domain'

export type Appointment = {
  id: string
  appointment_type: AppointmentType
  status: AppointmentStatus
  title: string
  starts_at: string
  ends_at: string | null
  location: string | null
  notes: string | null
  lead_id: string | null
  contact_id: string | null
  property_id: string | null
  assigned_to: string | null
  created_by: string | null
  lead: { id: string; contacts: { full_name: string } | null } | null
  property: { id: string; code: string; title: string } | null
  assignee: { full_name: string } | null
}

export type AgendaView = 'proximos' | 'anteriores' | 'cancelados'
