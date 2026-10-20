import type { ActivityType, LeadSource, Pipeline, PropertyPurpose, PropertyStatus, StageCategory } from '@/types/domain'

/** Linha da view lead_overview. */
export type LeadOverview = {
  id: string
  contact_id: string
  purpose: Pipeline
  source: LeadSource
  stage_id: string
  assigned_to: string | null
  min_budget: number | null
  max_budget: number | null
  desired_region: string | null
  notes: string | null
  next_follow_up_at: string | null
  stage_changed_at: string
  closed_at: string | null
  created_by: string | null
  created_at: string
  updated_at: string
  contact_name: string
  contact_phone: string
  contact_email: string | null
  stage_name: string
  stage_position: number
  stage_category: StageCategory
  assignee_name: string | null
  property_count: number
}

export type LeadProperty = {
  id: string
  code: string
  title: string
  status: PropertyStatus
  purpose: PropertyPurpose
  sale_price: number | null
  rent_price: number | null
  neighborhood: string | null
}

export type LeadDetail = LeadOverview & { properties: LeadProperty[] }

export type LeadFilters = {
  q: string
  funil: string
  etapa: string
  origem: string
  responsavel: string
  situacao: string
}

export type Activity = {
  id: string
  activity_type: ActivityType
  description: string
  occurred_at: string
  created_at: string
  updated_at: string
  created_by: string | null
  author_name: string | null
  lead_id: string | null
  contact_id: string | null
  metadata: Record<string, unknown> | null
}
