import { useQuery } from '@tanstack/react-query'
import type { PickerOption } from '@/components/forms/AsyncPicker'
import { formatPhone, normalizePhone } from '@/lib/format'
import { pipelineLabels } from '@/lib/labels'
import { getSupabase } from '@/lib/supabase'
import { range, sanitizeSearchTerm } from '@/lib/utils'
import type { Paginated, Pipeline, PipelineStage, StageCategory } from '@/types/domain'
import type { ActivityFormValues, LeadFormValues } from './schema'
import { toLeadPayload } from './schema'
import type { Activity, LeadDetail, LeadFilters, LeadOverview, LeadProperty } from './types'

export const LEADS_PAGE_SIZE = 15
export const KANBAN_LIMIT = 500

export const leadKeys = {
  all: ['leads'] as const,
  list: (filters: LeadFilters, page: number) => ['leads', 'list', filters, page] as const,
  kanban: (pipeline: Pipeline, filters: LeadFilters) => ['leads', 'kanban', pipeline, filters] as const,
  detail: (id: string) => ['leads', 'detail', id] as const,
  activities: (scope: 'lead' | 'contact', id: string) => ['activities', scope, id] as const,
}
export const stagesKey = ['pipeline-stages'] as const

// ---------------------------------------------------------------------------
// Etapas dos funis (configuráveis no banco)
// ---------------------------------------------------------------------------

export async function listStages(): Promise<PipelineStage[]> {
  const { data, error } = await getSupabase()
    .from('pipeline_stages')
    .select('id,pipeline,name,position,category,is_active')
    .order('pipeline')
    .order('position')
  if (error) throw error
  return (data ?? []) as PipelineStage[]
}

export function useStages() {
  return useQuery({ queryKey: stagesKey, queryFn: listStages, staleTime: 10 * 60_000 })
}

export const OPEN_CATEGORIES: StageCategory[] = ['aberto', 'negociacao']

// ---------------------------------------------------------------------------
// Consultas
// ---------------------------------------------------------------------------

type QueryBuilder = ReturnType<ReturnType<typeof getSupabase>['from']>
type FilterBuilder = ReturnType<QueryBuilder['select']>

function applyFilters(query: FilterBuilder, filters: LeadFilters, userId: string | undefined) {
  let next = query
  const term = sanitizeSearchTerm(filters.q)
  if (term) {
    const digits = normalizePhone(term)
    const clauses = [`contact_name.ilike.%${term}%`, `desired_region.ilike.%${term}%`, `contact_email.ilike.%${term}%`]
    if (digits.length >= 3) clauses.push(`contact_phone.ilike.%${digits}%`)
    next = next.or(clauses.join(','))
  }
  if (filters.origem) next = next.eq('source', filters.origem)
  if (filters.responsavel === 'eu' && userId) next = next.eq('assigned_to', userId)
  else if (filters.responsavel === 'nenhum') next = next.is('assigned_to', null)
  else if (filters.responsavel) next = next.eq('assigned_to', filters.responsavel)
  return next
}

export async function listLeads(filters: LeadFilters, page: number, userId: string | undefined): Promise<Paginated<LeadOverview>> {
  let query = applyFilters(getSupabase().from('lead_overview').select('*', { count: 'exact' }), filters, userId)
  if (filters.funil) query = query.eq('purpose', filters.funil)
  if (filters.etapa) query = query.eq('stage_id', filters.etapa)
  if (filters.situacao === 'concluidos') query = query.eq('stage_category', 'ganho')
  else if (filters.situacao === 'perdidos') query = query.eq('stage_category', 'perdido')
  else if (filters.situacao !== 'todos') query = query.in('stage_category', OPEN_CATEGORIES)

  const [from, to] = range(page, LEADS_PAGE_SIZE)
  const { data, count, error } = await query.order('created_at', { ascending: false }).range(from, to)
  if (error) throw error
  return { rows: (data ?? []) as LeadOverview[], count: count ?? 0 }
}

export async function listKanbanLeads(pipeline: Pipeline, filters: LeadFilters, userId: string | undefined) {
  const query = applyFilters(getSupabase().from('lead_overview').select('*', { count: 'exact' }), filters, userId)
  const { data, count, error } = await query
    .eq('purpose', pipeline)
    .order('stage_changed_at', { ascending: false })
    .limit(KANBAN_LIMIT)
  if (error) throw error
  return { rows: (data ?? []) as LeadOverview[], count: count ?? 0 }
}

export async function getLead(id: string): Promise<LeadDetail> {
  const supabase = getSupabase()
  const [lead, links] = await Promise.all([
    supabase.from('lead_overview').select('*').eq('id', id).single(),
    supabase
      .from('lead_properties')
      .select('properties(id,code,title,status,purpose,sale_price,rent_price,neighborhood)')
      .eq('lead_id', id),
  ])
  if (lead.error) throw lead.error
  if (links.error) throw links.error
  const properties = ((links.data ?? []) as unknown as { properties: LeadProperty | null }[])
    .map((row) => row.properties)
    .filter((property): property is LeadProperty => Boolean(property))
  return { ...(lead.data as LeadOverview), properties }
}

// ---------------------------------------------------------------------------
// Escrita
// ---------------------------------------------------------------------------

async function setLeadProperties(leadId: string, propertyIds: string[]) {
  const { error } = await getSupabase().rpc('set_lead_properties', { p_lead_id: leadId, p_property_ids: propertyIds })
  if (error) throw error
}

export async function createLead(values: LeadFormValues, propertyIds: string[]) {
  const { data, error } = await getSupabase().from('leads').insert(toLeadPayload(values)).select('id').single()
  if (error) throw error
  const id = (data as { id: string }).id
  await setLeadProperties(id, propertyIds)
  return id
}

export async function updateLead(id: string, values: LeadFormValues, propertyIds: string[]) {
  const { error, count } = await getSupabase().from('leads').update(toLeadPayload(values), { count: 'exact' }).eq('id', id)
  if (error) throw error
  if (count === 0) throw new Error('Você só pode editar leads sob sua responsabilidade.')
  await setLeadProperties(id, propertyIds)
}

export async function moveLeadStage(id: string, stageId: string) {
  const { error, count } = await getSupabase().from('leads').update({ stage_id: stageId }, { count: 'exact' }).eq('id', id)
  if (error) throw error
  if (count === 0) throw new Error('Você só pode mover leads sob sua responsabilidade.')
}

export async function deleteLead(id: string) {
  const { error, count } = await getSupabase().from('leads').delete({ count: 'exact' }).eq('id', id)
  if (error) throw error
  if (count === 0) throw new Error('Você não tem permissão para excluir este lead.')
}

// ---------------------------------------------------------------------------
// Histórico de atividades
// ---------------------------------------------------------------------------

type ActivityRow = Omit<Activity, 'author_name'> & { author: { full_name: string } | null }

export async function listActivities(scope: 'lead' | 'contact', id: string): Promise<Activity[]> {
  const { data, error } = await getSupabase()
    .from('activities')
    .select(
      'id,activity_type,description,occurred_at,created_at,updated_at,created_by,lead_id,contact_id,metadata, author:profiles!activities_created_by_fkey(full_name)',
    )
    .eq(scope === 'lead' ? 'lead_id' : 'contact_id', id)
    .order('occurred_at', { ascending: false })
    .limit(100)
  if (error) throw error
  return ((data ?? []) as unknown as ActivityRow[]).map(({ author, ...activity }) => ({
    ...activity,
    author_name: author?.full_name || null,
  }))
}

export async function createActivity(values: ActivityFormValues, subject: { leadId?: string; contactId?: string }) {
  const { error } = await getSupabase().from('activities').insert({
    activity_type: values.activity_type,
    description: values.description.trim(),
    lead_id: subject.leadId ?? null,
    contact_id: subject.contactId ?? null,
  })
  if (error) throw error
}

export async function updateActivity(id: string, description: string) {
  const { error, count } = await getSupabase()
    .from('activities')
    .update({ description: description.trim() }, { count: 'exact' })
    .eq('id', id)
  if (error) throw error
  if (count === 0) throw new Error('Você só pode editar atividades registradas por você.')
}

export async function deleteActivity(id: string) {
  const { error, count } = await getSupabase().from('activities').delete({ count: 'exact' }).eq('id', id)
  if (error) throw error
  if (count === 0) throw new Error('Você só pode excluir atividades registradas por você.')
}

/** Apaga todo o histórico de um lead ou contato (permitido a administradores pelo RLS). */
export async function deleteAllActivities(scope: 'lead' | 'contact', id: string) {
  const { error, count } = await getSupabase()
    .from('activities')
    .delete({ count: 'exact' })
    .eq(scope === 'lead' ? 'lead_id' : 'contact_id', id)
  if (error) throw error
  return count ?? 0
}

export async function searchLeadOptions(term: string): Promise<PickerOption[]> {
  let query = getSupabase()
    .from('lead_overview')
    .select('id,contact_id,contact_name,contact_phone,purpose,stage_name')
    .in('stage_category', OPEN_CATEGORIES)
    .order('created_at', { ascending: false })
    .limit(12)
  const clean = sanitizeSearchTerm(term)
  if (clean) query = query.ilike('contact_name', `%${clean}%`)
  const { data, error } = await query
  if (error) throw error
  return ((data ?? []) as Pick<LeadOverview, 'id' | 'contact_name' | 'contact_phone' | 'purpose' | 'stage_name'>[]).map((lead) => ({
    id: lead.id,
    label: lead.contact_name,
    description: `${pipelineLabels[lead.purpose]} · ${lead.stage_name} · ${formatPhone(lead.contact_phone)}`,
  }))
}
