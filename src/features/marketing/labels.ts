import type { BadgeTone } from '@/components/ui/Badge'
import type { CampaignObjective, CampaignPlatform, CampaignStatus } from './types'

export const campaignPlatformLabels: Record<CampaignPlatform, string> = {
  meta_ads: 'Meta Ads (Facebook e Instagram)',
  google_ads: 'Google Ads',
  tiktok_ads: 'TikTok Ads',
  linkedin_ads: 'LinkedIn Ads',
  outro: 'Outra plataforma',
}

/** Nome curto para listas e tabelas. */
export const campaignPlatformShortLabels: Record<CampaignPlatform, string> = {
  meta_ads: 'Meta Ads',
  google_ads: 'Google Ads',
  tiktok_ads: 'TikTok Ads',
  linkedin_ads: 'LinkedIn Ads',
  outro: 'Outra',
}

export const campaignObjectiveLabels: Record<CampaignObjective, string> = {
  leads: 'Geração de leads (formulário)',
  mensagens: 'Mensagens (WhatsApp / Direct)',
  trafego: 'Tráfego para o site',
  reconhecimento: 'Reconhecimento de marca',
  vendas: 'Conversões / vendas',
}

export const campaignStatusLabels: Record<CampaignStatus, string> = {
  rascunho: 'Rascunho',
  ativa: 'Ativa',
  pausada: 'Pausada',
  encerrada: 'Encerrada',
}

export const campaignStatusTones: Record<CampaignStatus, BadgeTone> = {
  rascunho: 'neutral',
  ativa: 'success',
  pausada: 'warning',
  encerrada: 'info',
}
