import { money, optionalText, optionalUuid, requiredText, z } from '@/lib/validations'
import { nullIfBlank } from '@/lib/utils'
import { PIPELINES } from '@/types/domain'
import { CAMPAIGN_OBJECTIVES, CAMPAIGN_PLATFORMS, CAMPAIGN_STATUSES, type Campaign, type LandingPage } from './types'

const url = z
  .string()
  .trim()
  .max(500, 'O endereço deve ter no máximo 500 caracteres.')
  .refine((value) => value === '' || /^https?:\/\/\S+$/i.test(value), 'Informe o endereço completo, começando com https://')

const count = (label: string) =>
  z
    .number({ error: `${label} deve ser um número inteiro.` })
    .int(`${label} deve ser um número inteiro.`)
    .min(0, `${label} não pode ser negativo.`)
    .max(2_000_000_000, `${label} é muito alto.`)
    .nullable()

const date = z.string().refine((value) => value === '' || /^\d{4}-\d{2}-\d{2}$/.test(value), 'Informe uma data válida.')

// ---------------------------------------------------------------------------
// Landing pages
// ---------------------------------------------------------------------------

export const landingPageSchema = z.object({
  name: requiredText('o nome', 2, 80),
  purpose: requiredText('o propósito', 2, 120),
  url,
  pipeline: z.enum(PIPELINES, { error: 'Selecione o funil.' }),
  default_assignee: optionalUuid,
  is_active: z.boolean(),
  notes: optionalText(2000, 'As observações'),
})

export type LandingPageFormValues = z.infer<typeof landingPageSchema>

export const emptyLandingPageValues: LandingPageFormValues = {
  name: '',
  purpose: '',
  url: '',
  pipeline: 'venda',
  default_assignee: '',
  is_active: true,
  notes: '',
}

export function landingPageToFormValues(page: LandingPage): LandingPageFormValues {
  return {
    name: page.name,
    purpose: page.purpose,
    url: page.url ?? '',
    pipeline: page.pipeline,
    default_assignee: page.default_assignee ?? '',
    is_active: page.is_active,
    notes: page.notes ?? '',
  }
}

export function toLandingPagePayload(values: LandingPageFormValues) {
  return {
    name: values.name.trim(),
    purpose: values.purpose.trim(),
    url: nullIfBlank(values.url),
    pipeline: values.pipeline,
    default_assignee: nullIfBlank(values.default_assignee),
    is_active: values.is_active,
    notes: nullIfBlank(values.notes),
  }
}

// ---------------------------------------------------------------------------
// Campanhas
// ---------------------------------------------------------------------------

export const campaignSchema = z
  .object({
    name: requiredText('o nome', 2, 120),
    platform: z.enum(CAMPAIGN_PLATFORMS, { error: 'Selecione a plataforma.' }),
    objective: z.enum(CAMPAIGN_OBJECTIVES, { error: 'Selecione o objetivo.' }),
    status: z.enum(CAMPAIGN_STATUSES, { error: 'Selecione a situação.' }),
    landing_page_id: optionalUuid,
    utm_campaign: z
      .string()
      .trim()
      .max(80, 'O identificador deve ter no máximo 80 caracteres.')
      .refine((value) => value === '' || /^[A-Za-z0-9_.-]+$/.test(value), 'Use apenas letras sem acento, números, hífen, ponto ou sublinhado.'),
    starts_on: date,
    ends_on: date,
    budget: money('O orçamento'),
    spent: money('O valor investido'),
    impressions: count('O número de impressões'),
    clicks: count('O número de cliques'),
    notes: optionalText(5000, 'As observações'),
  })
  .superRefine((values, ctx) => {
    if (values.starts_on && values.ends_on && values.ends_on < values.starts_on) {
      ctx.addIssue({ code: 'custom', path: ['ends_on'], message: 'O término não pode ser antes do início.' })
    }
    if (values.clicks !== null && values.impressions !== null && values.clicks > values.impressions && values.impressions > 0) {
      ctx.addIssue({ code: 'custom', path: ['clicks'], message: 'Os cliques não podem passar das impressões.' })
    }
  })

export type CampaignFormValues = z.infer<typeof campaignSchema>

export const emptyCampaignValues: CampaignFormValues = {
  name: '',
  platform: 'meta_ads',
  objective: 'leads',
  status: 'ativa',
  landing_page_id: '',
  utm_campaign: '',
  starts_on: '',
  ends_on: '',
  budget: null,
  spent: null,
  impressions: null,
  clicks: null,
  notes: '',
}

/** numeric do Postgres pode chegar como string pelo PostgREST. */
function toNumberOrNull(value: number | string | null) {
  if (value === null || value === undefined) return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

export function campaignToFormValues(campaign: Campaign): CampaignFormValues {
  return {
    name: campaign.name,
    platform: campaign.platform,
    objective: campaign.objective,
    status: campaign.status,
    landing_page_id: campaign.landing_page_id ?? '',
    utm_campaign: campaign.utm_campaign ?? '',
    starts_on: campaign.starts_on ?? '',
    ends_on: campaign.ends_on ?? '',
    budget: toNumberOrNull(campaign.budget),
    spent: toNumberOrNull(campaign.spent),
    impressions: campaign.impressions || null,
    clicks: campaign.clicks || null,
    notes: campaign.notes ?? '',
  }
}

export function toCampaignPayload(values: CampaignFormValues) {
  return {
    name: values.name.trim(),
    platform: values.platform,
    objective: values.objective,
    status: values.status,
    landing_page_id: nullIfBlank(values.landing_page_id),
    utm_campaign: nullIfBlank(values.utm_campaign.toLowerCase()),
    starts_on: nullIfBlank(values.starts_on),
    ends_on: nullIfBlank(values.ends_on),
    budget: values.budget,
    spent: values.spent ?? 0,
    impressions: values.impressions ?? 0,
    clicks: values.clicks ?? 0,
    notes: nullIfBlank(values.notes),
  }
}

/** Sugestão de identificador UTM a partir do nome (sem acentos, minúsculo, com hífens). */
export function suggestUtm(name: string) {
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
}
