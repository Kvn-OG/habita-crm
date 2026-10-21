import type { Pipeline } from '@/types/domain'

/** Espelham os checks da tabela campaigns (supabase/migrations). */
export const CAMPAIGN_PLATFORMS = ['meta_ads', 'google_ads', 'tiktok_ads', 'linkedin_ads', 'outro'] as const
export type CampaignPlatform = (typeof CAMPAIGN_PLATFORMS)[number]

export const CAMPAIGN_OBJECTIVES = ['leads', 'mensagens', 'trafego', 'reconhecimento', 'vendas'] as const
export type CampaignObjective = (typeof CAMPAIGN_OBJECTIVES)[number]

export const CAMPAIGN_STATUSES = ['rascunho', 'ativa', 'pausada', 'encerrada'] as const
export type CampaignStatus = (typeof CAMPAIGN_STATUSES)[number]

/** Limite de landing pages por instalação (garantido também pelo banco). */
export const MAX_LANDING_PAGES = 5

export type LandingPage = {
  id: string
  name: string
  purpose: string
  url: string | null
  pipeline: Pipeline
  default_assignee: string | null
  is_active: boolean
  token: string
  notes: string | null
  created_at: string
  updated_at: string
}

export type LandingPageOverview = LandingPage & {
  assignee_name: string | null
  leads_total: number
  leads_30d: number
  last_lead_at: string | null
  deals_won: number
  won_amount: number | string
}

export type Campaign = {
  id: string
  name: string
  platform: CampaignPlatform
  objective: CampaignObjective
  status: CampaignStatus
  landing_page_id: string | null
  utm_campaign: string | null
  starts_on: string | null
  ends_on: string | null
  budget: number | string | null
  spent: number | string
  impressions: number
  clicks: number
  notes: string | null
  created_at: string
  updated_at: string
}

export type CampaignOverview = Campaign & {
  landing_page_name: string | null
  leads: number
  deals_won: number
  won_amount: number | string
  cost_per_lead: number | string | null
  cost_per_deal: number | string | null
  ctr: number | string | null
}
