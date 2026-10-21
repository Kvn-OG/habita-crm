import { getSupabase } from '@/lib/supabase'
import { range, sanitizeSearchTerm } from '@/lib/utils'
import type { DealStatus, Paginated, Pipeline, ProposalStatus } from '@/types/domain'
import { toDealPayload, toProposalPayload, type DealFormValues, type ProposalFormValues } from './schema'
import type { DealFilters, DealOverview, Proposal } from './types'

export const DEALS_PAGE_SIZE = 15

export const dealKeys = {
  all: ['deals'] as const,
  list: (filters: DealFilters, page: number) => ['deals', 'list', filters, page] as const,
  detail: (id: string) => ['deals', 'detail', id] as const,
  byLead: (leadId: string) => ['deals', 'lead', leadId] as const,
  proposals: (dealId: string) => ['deals', 'proposals', dealId] as const,
}

/** Consultas que mudam junto com uma negociação (imóvel, lead, histórico e indicadores). */
export const DEAL_RELATED_KEYS = [['deals'], ['leads'], ['properties'], ['contacts'], ['activities'], ['dashboard'], ['reports']] as const

// ---------------------------------------------------------------------------
// Consultas
// ---------------------------------------------------------------------------

export async function listDeals(filters: DealFilters, page: number, userId: string | undefined): Promise<Paginated<DealOverview>> {
  let query = getSupabase().from('deal_overview').select('*', { count: 'exact' })

  const term = sanitizeSearchTerm(filters.q)
  if (term) query = query.or(`contact_name.ilike.%${term}%,property_code.ilike.%${term}%,property_title.ilike.%${term}%`)
  if (filters.tipo) query = query.eq('deal_type', filters.tipo)
  // Sem filtro de situação, mostra as negociações em andamento.
  if (filters.situacao !== 'todas') query = query.eq('status', filters.situacao || 'em_andamento')
  if (filters.responsavel === 'eu' && userId) query = query.eq('assigned_to', userId)
  else if (filters.responsavel === 'nenhum') query = query.is('assigned_to', null)
  else if (filters.responsavel) query = query.eq('assigned_to', filters.responsavel)

  const [from, to] = range(page, DEALS_PAGE_SIZE)
  const { data, count, error } = await query.order('updated_at', { ascending: false }).range(from, to)
  if (error) throw error
  return { rows: (data ?? []) as DealOverview[], count: count ?? 0 }
}

export async function getDeal(id: string): Promise<DealOverview> {
  const { data, error } = await getSupabase().from('deal_overview').select('*').eq('id', id).single()
  if (error) throw error
  return data as DealOverview
}

export async function listLeadDeals(leadId: string): Promise<DealOverview[]> {
  const { data, error } = await getSupabase()
    .from('deal_overview')
    .select('*')
    .eq('lead_id', leadId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as DealOverview[]
}

type ProposalRow = Omit<Proposal, 'author_name'> & { author: { full_name: string } | null }

export async function listProposals(dealId: string): Promise<Proposal[]> {
  const { data, error } = await getSupabase()
    .from('proposals')
    .select('id,deal_id,amount,status,valid_until,conditions,created_by,created_at,updated_at, author:profiles!proposals_created_by_fkey(full_name)')
    .eq('deal_id', dealId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return ((data ?? []) as unknown as ProposalRow[]).map(({ author, ...proposal }) => ({
    ...proposal,
    author_name: author?.full_name || null,
  }))
}

// ---------------------------------------------------------------------------
// Escrita
// ---------------------------------------------------------------------------

export async function createDeal(values: DealFormValues) {
  const supabase = getSupabase()
  // O tipo da negociação acompanha a finalidade do lead (também validado no banco).
  const { data: lead, error: leadError } = await supabase.from('leads').select('purpose').eq('id', values.lead_id).single()
  if (leadError) throw leadError
  const { data, error } = await supabase
    .from('deals')
    .insert({ ...toDealPayload(values), lead_id: values.lead_id, deal_type: (lead as { purpose: Pipeline }).purpose })
    .select('id')
    .single()
  if (error) throw error
  return (data as { id: string }).id
}

export async function updateDeal(id: string, values: DealFormValues) {
  const { error, count } = await getSupabase().from('deals').update(toDealPayload(values), { count: 'exact' }).eq('id', id)
  if (error) throw error
  if (count === 0) throw new Error('Você só pode editar negociações sob sua responsabilidade.')
}

export async function setDealStatus(id: string, status: DealStatus, lossReason?: string) {
  const { error, count } = await getSupabase()
    .from('deals')
    .update({ status, loss_reason: status === 'perdido' ? (lossReason ?? null) : null }, { count: 'exact' })
    .eq('id', id)
  if (error) throw error
  if (count === 0) throw new Error('Você só pode alterar negociações sob sua responsabilidade.')
}

export async function deleteDeal(id: string) {
  const { error, count } = await getSupabase().from('deals').delete({ count: 'exact' }).eq('id', id)
  if (error) throw error
  if (count === 0) throw new Error('Você não tem permissão para excluir esta negociação.')
}

export async function createProposal(dealId: string, values: ProposalFormValues) {
  const { error } = await getSupabase().from('proposals').insert({ ...toProposalPayload(values), deal_id: dealId })
  if (error) throw error
}

export async function updateProposal(id: string, values: ProposalFormValues) {
  const { error, count } = await getSupabase().from('proposals').update(toProposalPayload(values), { count: 'exact' }).eq('id', id)
  if (error) throw error
  if (count === 0) throw new Error('Você não tem permissão para alterar esta proposta.')
}

export async function setProposalStatus(id: string, status: ProposalStatus) {
  const { error, count } = await getSupabase().from('proposals').update({ status }, { count: 'exact' }).eq('id', id)
  if (error) throw error
  if (count === 0) throw new Error('Você não tem permissão para alterar esta proposta.')
}

export async function deleteProposal(id: string) {
  const { error, count } = await getSupabase().from('proposals').delete({ count: 'exact' }).eq('id', id)
  if (error) throw error
  if (count === 0) throw new Error('Você não tem permissão para excluir esta proposta.')
}
