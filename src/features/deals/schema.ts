import { nullIfBlank } from '@/lib/utils'
import { money, optionalText, z } from '@/lib/validations'
import { PROPOSAL_STATUSES } from '@/types/domain'
import type { DealOverview, Proposal } from './types'

const optionalDate = z
  .string()
  .refine((value) => value === '' || /^\d{4}-\d{2}-\d{2}$/.test(value), 'Informe uma data válida.')

export const dealSchema = z.object({
  lead_id: z.string().min(1, 'Selecione o lead da negociação.'),
  property_id: z.string(),
  assigned_to: z.string(),
  amount: money('O valor'),
  expected_close_date: optionalDate,
  notes: optionalText(5000, 'As observações'),
})

export type DealFormValues = z.infer<typeof dealSchema>

export function dealToFormValues(deal: DealOverview): DealFormValues {
  return {
    lead_id: deal.lead_id,
    property_id: deal.property_id ?? '',
    assigned_to: deal.assigned_to ?? '',
    amount: deal.amount === null ? null : Number(deal.amount),
    expected_close_date: deal.expected_close_date ?? '',
    notes: deal.notes ?? '',
  }
}

export function toDealPayload(values: DealFormValues) {
  return {
    property_id: values.property_id || null,
    assigned_to: values.assigned_to || null,
    amount: values.amount,
    expected_close_date: values.expected_close_date || null,
    notes: nullIfBlank(values.notes),
  }
}

export const proposalSchema = z
  .object({
    amount: money('O valor da proposta'),
    status: z.enum(PROPOSAL_STATUSES),
    valid_until: optionalDate,
    conditions: optionalText(10000, 'As condições'),
  })
  .superRefine((values, ctx) => {
    if (values.amount === null) ctx.addIssue({ code: 'custom', path: ['amount'], message: 'Informe o valor da proposta.' })
  })

export type ProposalFormValues = z.infer<typeof proposalSchema>

export function proposalToFormValues(proposal: Proposal): ProposalFormValues {
  return {
    amount: Number(proposal.amount),
    status: proposal.status,
    valid_until: proposal.valid_until ?? '',
    conditions: proposal.conditions ?? '',
  }
}

export function toProposalPayload(values: ProposalFormValues) {
  return {
    amount: values.amount,
    status: values.status,
    valid_until: values.valid_until || null,
    conditions: nullIfBlank(values.conditions),
  }
}

/** Motivo da perda: um dos sugeridos ou texto livre quando "Outro". */
export const lossSchema = z
  .object({
    reason: z.string().min(1, 'Selecione o motivo da perda.'),
    details: z.string().trim().max(280, 'Use no máximo 280 caracteres.'),
  })
  .superRefine((values, ctx) => {
    if (values.reason === 'outro' && values.details === '') {
      ctx.addIssue({ code: 'custom', path: ['details'], message: 'Descreva o motivo da perda.' })
    }
  })

export type LossFormValues = z.infer<typeof lossSchema>

export function lossReasonText(values: LossFormValues) {
  if (values.reason === 'outro') return values.details.trim()
  return values.details ? `${values.reason} (${values.details.trim()})` : values.reason
}
