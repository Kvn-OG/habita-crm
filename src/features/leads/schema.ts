import { fromDateTimeLocalInput, toDateTimeLocalInput } from '@/lib/format'
import { nullIfBlank } from '@/lib/utils'
import { money, optionalText, z } from '@/lib/validations'
import { LEAD_SOURCES, MANUAL_ACTIVITY_TYPES, PIPELINES } from '@/types/domain'
import type { LeadOverview } from './types'

export const leadSchema = z
  .object({
    contact_id: z.string().min(1, 'Selecione o contato relacionado.'),
    purpose: z.enum(PIPELINES, { error: 'Selecione a finalidade.' }),
    source: z.enum(LEAD_SOURCES, { error: 'Selecione a origem.' }),
    stage_id: z.string().min(1, 'Selecione a etapa comercial.'),
    assigned_to: z.string(),
    min_budget: money('O orçamento mínimo'),
    max_budget: money('O orçamento máximo'),
    desired_region: optionalText(200, 'A região desejada'),
    next_follow_up_at: z
      .string()
      .refine((value) => value === '' || !Number.isNaN(new Date(value).getTime()), 'Informe uma data e hora válidas.'),
    notes: optionalText(5000, 'As observações'),
  })
  .superRefine((values, ctx) => {
    if (values.min_budget !== null && values.max_budget !== null && values.min_budget > values.max_budget) {
      ctx.addIssue({ code: 'custom', path: ['max_budget'], message: 'O orçamento máximo deve ser maior ou igual ao mínimo.' })
    }
  })

export type LeadFormValues = z.infer<typeof leadSchema>

export function leadToFormValues(lead: LeadOverview): LeadFormValues {
  return {
    contact_id: lead.contact_id,
    purpose: lead.purpose,
    source: lead.source,
    stage_id: lead.stage_id,
    assigned_to: lead.assigned_to ?? '',
    min_budget: lead.min_budget === null ? null : Number(lead.min_budget),
    max_budget: lead.max_budget === null ? null : Number(lead.max_budget),
    desired_region: lead.desired_region ?? '',
    next_follow_up_at: toDateTimeLocalInput(lead.next_follow_up_at),
    notes: lead.notes ?? '',
  }
}

export function toLeadPayload(values: LeadFormValues) {
  return {
    contact_id: values.contact_id,
    purpose: values.purpose,
    source: values.source,
    stage_id: values.stage_id,
    assigned_to: values.assigned_to || null,
    min_budget: values.min_budget,
    max_budget: values.max_budget,
    desired_region: nullIfBlank(values.desired_region),
    next_follow_up_at: fromDateTimeLocalInput(values.next_follow_up_at),
    notes: nullIfBlank(values.notes),
  }
}

export const activitySchema = z.object({
  activity_type: z.enum(MANUAL_ACTIVITY_TYPES),
  description: z.string().trim().min(1, 'Descreva a atividade.').max(5000, 'Use no máximo 5.000 caracteres.'),
})
export type ActivityFormValues = z.infer<typeof activitySchema>
