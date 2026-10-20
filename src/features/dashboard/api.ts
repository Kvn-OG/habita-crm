import { getSupabase } from '@/lib/supabase'
import type { ActivityType, Pipeline, StageCategory } from '@/types/domain'
import { OPEN_CATEGORIES } from '@/features/leads/api'

export type DashboardMetrics = {
  properties_total: number
  properties_available: number
  leads_active: number
  visits_scheduled: number
  negotiations_in_progress: number
  sales_closed: number
  rentals_closed: number
  leads_by_stage: { pipeline: Pipeline; name: string; position: number; category: StageCategory; total: number }[]
}

export type AgendaEntry = {
  id: string
  kind: 'appointment' | 'task'
  title: string
  at: string
  subtitle: string | null
  href: string | null
}

export type RecentActivity = {
  id: string
  activity_type: ActivityType
  description: string
  occurred_at: string
  author_name: string | null
  lead_id: string | null
  contact_id: string | null
  subject_name: string | null
  metadata: Record<string, unknown> | null
}

export type FollowUp = {
  id: string
  contact_name: string
  purpose: Pipeline
  stage_name: string
  stage_category: StageCategory
  desired_region: string | null
  next_follow_up_at: string
}

export const dashboardKeys = {
  metrics: ['dashboard', 'metrics'] as const,
  agenda: ['dashboard', 'agenda'] as const,
  activities: ['dashboard', 'activities'] as const,
  followUps: ['dashboard', 'follow-ups'] as const,
}

export async function fetchMetrics(): Promise<DashboardMetrics> {
  const { data, error } = await getSupabase().rpc('dashboard_metrics')
  if (error) throw error
  return data as DashboardMetrics
}

/** Próximas visitas/reuniões e tarefas em aberto com prazo. */
export async function fetchAgenda(): Promise<AgendaEntry[]> {
  const supabase = getSupabase()
  const now = new Date().toISOString()
  const [appointments, tasks] = await Promise.all([
    supabase
      .from('appointments')
      .select('id,title,starts_at,location,lead_id, property:properties(code)')
      .eq('status', 'agendado')
      .gte('starts_at', now)
      .order('starts_at')
      .limit(6),
    supabase
      .from('tasks')
      .select('id,title,due_at,lead_id')
      .is('completed_at', null)
      .not('due_at', 'is', null)
      .order('due_at')
      .limit(6),
  ])
  if (appointments.error) throw appointments.error
  if (tasks.error) throw tasks.error

  type AppointmentRow = { id: string; title: string; starts_at: string; location: string | null; lead_id: string | null; property: { code: string } | null }
  type TaskRow = { id: string; title: string; due_at: string; lead_id: string | null }

  const entries: AgendaEntry[] = [
    ...((appointments.data ?? []) as unknown as AppointmentRow[]).map((row) => ({
      id: row.id,
      kind: 'appointment' as const,
      title: row.title,
      at: row.starts_at,
      subtitle: [row.property?.code, row.location].filter(Boolean).join(' · ') || null,
      href: row.lead_id ? `/leads/${row.lead_id}` : '/agenda',
    })),
    ...((tasks.data ?? []) as TaskRow[]).map((row) => ({
      id: row.id,
      kind: 'task' as const,
      title: row.title,
      at: row.due_at,
      subtitle: 'Tarefa',
      href: row.lead_id ? `/leads/${row.lead_id}` : null,
    })),
  ]
  return entries.sort((a, b) => a.at.localeCompare(b.at)).slice(0, 6)
}

export async function fetchRecentActivities(): Promise<RecentActivity[]> {
  const { data, error } = await getSupabase()
    .from('activities')
    .select(
      'id,activity_type,description,occurred_at,lead_id,contact_id,metadata, author:profiles!activities_created_by_fkey(full_name), contact:contacts(full_name)',
    )
    .order('occurred_at', { ascending: false })
    // Busca alguns a mais: retrocessos de etapa são ocultados na tela.
    .limit(16)
  if (error) throw error
  type Row = Omit<RecentActivity, 'author_name' | 'subject_name'> & {
    author: { full_name: string } | null
    contact: { full_name: string } | null
  }
  return ((data ?? []) as unknown as Row[]).map(({ author, contact, ...row }) => ({
    ...row,
    author_name: author?.full_name || null,
    subject_name: contact?.full_name ?? null,
  }))
}

/** Leads em andamento com retorno atrasado ou nos próximos 7 dias. */
export async function fetchFollowUps(): Promise<FollowUp[]> {
  const limit = new Date(Date.now() + 7 * 86_400_000).toISOString()
  const { data, error } = await getSupabase()
    .from('lead_overview')
    .select('id,contact_name,purpose,stage_name,stage_category,desired_region,next_follow_up_at')
    .in('stage_category', OPEN_CATEGORIES)
    .not('next_follow_up_at', 'is', null)
    .lte('next_follow_up_at', limit)
    .order('next_follow_up_at')
    .limit(6)
  if (error) throw error
  return (data ?? []) as FollowUp[]
}
