import type { ActivityType, PipelineStage } from '@/types/domain'

type StageChange = { activity_type: ActivityType; metadata: Record<string, unknown> | null }

/**
 * Indica se uma mudança de etapa voltou o lead para uma etapa anterior do funil.
 * Esses registros permanecem no banco (auditoria), mas não são exibidos no histórico.
 * Ir para "Perdido" conta como avanço, pois é a última etapa do funil.
 */
export function isStageRegression(activity: StageChange, stages: PipelineStage[]) {
  if (activity.activity_type !== 'mudanca_etapa' || !activity.metadata) return false
  const from = stages.find((stage) => stage.id === activity.metadata?.from_stage_id)
  const to = stages.find((stage) => stage.id === activity.metadata?.to_stage_id)
  return Boolean(from && to && to.position < from.position)
}

/** Anotação alterada após o registro (tolerância de 1 minuto). */
export function wasEdited(activity: { created_at: string; updated_at: string }) {
  return new Date(activity.updated_at).getTime() - new Date(activity.created_at).getTime() > 60_000
}

/** Tipos gerados automaticamente pelo sistema: não podem ser editados nem excluídos. */
export const AUTOMATIC_ACTIVITY_TYPES: ActivityType[] = ['mudanca_etapa', 'sistema']
