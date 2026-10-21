import type { DealStatus, Pipeline, PropertyStatus, ProposalStatus } from '@/types/domain'

/** Linha da view deal_overview. */
export type DealOverview = {
  id: string
  lead_id: string
  property_id: string | null
  deal_type: Pipeline
  status: DealStatus
  amount: number | null
  expected_close_date: string | null
  closed_at: string | null
  loss_reason: string | null
  notes: string | null
  assigned_to: string | null
  created_by: string | null
  created_at: string
  updated_at: string
  contact_id: string
  contact_name: string
  contact_phone: string
  property_code: string | null
  property_title: string | null
  property_status: PropertyStatus | null
  assignee_name: string | null
  proposal_count: number
  last_proposal_amount: number | null
  last_proposal_status: ProposalStatus | null
}

export type Proposal = {
  id: string
  deal_id: string
  amount: number
  status: ProposalStatus
  valid_until: string | null
  conditions: string | null
  created_by: string | null
  author_name: string | null
  created_at: string
  updated_at: string
}

export type DealFilters = {
  q: string
  situacao: string
  tipo: string
  responsavel: string
}
