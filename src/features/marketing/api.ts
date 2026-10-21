import { getSupabase } from '@/lib/supabase'
import { toCampaignPayload, toLandingPagePayload, type CampaignFormValues, type LandingPageFormValues } from './schema'
import type { CampaignOverview, LandingPageOverview } from './types'

export const marketingKeys = {
  all: ['marketing'] as const,
  landingPages: ['marketing', 'landing-pages'] as const,
  campaigns: ['marketing', 'campaigns'] as const,
}

/** Endereço que o formulário de cada landing page usa para enviar leads. */
export function leadEndpoint() {
  return `${window.location.origin}/api/public/lead`
}

// ---------------------------------------------------------------------------
// Landing pages
// ---------------------------------------------------------------------------

export async function listLandingPages(): Promise<LandingPageOverview[]> {
  const { data, error } = await getSupabase().from('landing_page_overview').select('*').order('created_at')
  if (error) throw error
  return (data ?? []) as LandingPageOverview[]
}

export async function saveLandingPage(values: LandingPageFormValues, id?: string) {
  const supabase = getSupabase()
  const payload = toLandingPagePayload(values)
  const { error } = id
    ? await supabase.from('landing_pages').update(payload).eq('id', id)
    : await supabase.from('landing_pages').insert(payload)
  if (error) throw error
}

/** Os leads já recebidos continuam no funil; apenas perdem o vínculo com a página. */
export async function deleteLandingPage(id: string) {
  const { error, count } = await getSupabase().from('landing_pages').delete({ count: 'exact' }).eq('id', id)
  if (error) throw error
  if (count === 0) throw new Error('Você não tem permissão para excluir esta landing page.')
}

// ---------------------------------------------------------------------------
// Campanhas
// ---------------------------------------------------------------------------

export async function listCampaigns(): Promise<CampaignOverview[]> {
  const { data, error } = await getSupabase()
    .from('campaign_overview')
    .select('*')
    .order('status')
    .order('starts_on', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as CampaignOverview[]
}

export async function saveCampaign(values: CampaignFormValues, id?: string) {
  const supabase = getSupabase()
  const payload = toCampaignPayload(values)
  const { error } = id
    ? await supabase.from('campaigns').update(payload).eq('id', id)
    : await supabase.from('campaigns').insert(payload)
  if (error) throw error
}

export async function deleteCampaign(id: string) {
  const { error, count } = await getSupabase().from('campaigns').delete({ count: 'exact' }).eq('id', id)
  if (error) throw error
  if (count === 0) throw new Error('Você não tem permissão para excluir esta campanha.')
}
