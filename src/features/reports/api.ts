import { getSupabase } from '@/lib/supabase'
import type { LeadSource, Pipeline, StageCategory } from '@/types/domain'

export type ReportData = {
  funnel: { pipeline: Pipeline; name: string; position: number; category: StageCategory; total: number }[]
  sources: { pipeline: Pipeline; source: LeadSource; total: number; won: number; lost: number }[]
  stage_times: { pipeline: Pipeline; name: string; position: number; avg_days: number; samples: number }[]
  brokers: { id: string; full_name: string; leads: number; visits: number; deals_open: number; deals_won: number; won_amount: number }[]
  deals: {
    open_count: number
    open_amount: number
    won_count: number
    won_amount: number
    lost_count: number
    cancelled_count: number
    avg_days_to_close: number | null
  }
  monthly: { month: string; pipeline: Pipeline; total: number; amount: number }[]
  loss_reasons: { reason: string; total: number }[]
}

export type ReportParams = { from: string; to: string; pipeline: Pipeline | null }

export const reportKeys = {
  metrics: (params: ReportParams) => ['reports', params] as const,
}

export async function fetchReport({ from, to, pipeline }: ReportParams): Promise<ReportData> {
  const { data, error } = await getSupabase().rpc('report_metrics', { p_from: from, p_to: to, p_pipeline: pipeline })
  if (error) throw error
  return data as ReportData
}
