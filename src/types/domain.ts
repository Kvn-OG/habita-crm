/**
 * Tipos de domínio espelhando os enums do banco (supabase/migrations).
 * Para tipos gerados automaticamente, veja a seção "Tipos do banco" no README.
 */

export const APP_ROLES = ['admin', 'gestor', 'corretor'] as const
export type AppRole = (typeof APP_ROLES)[number]

export const CONTACT_TYPES = ['comprador', 'interessado_locacao', 'proprietario', 'outro'] as const
export type ContactType = (typeof CONTACT_TYPES)[number]

export const PROPERTY_TYPES = [
  'apartamento', 'casa', 'casa_condominio', 'cobertura', 'kitnet', 'terreno',
  'sala_comercial', 'loja', 'galpao', 'sitio_chacara', 'outro',
] as const
export type PropertyType = (typeof PROPERTY_TYPES)[number]

export const PROPERTY_PURPOSES = ['venda', 'locacao', 'ambos'] as const
export type PropertyPurpose = (typeof PROPERTY_PURPOSES)[number]

export const PROPERTY_STATUSES = [
  'disponivel', 'reservado', 'em_negociacao', 'vendido', 'alugado', 'indisponivel',
] as const
export type PropertyStatus = (typeof PROPERTY_STATUSES)[number]

export const PIPELINES = ['venda', 'locacao'] as const
export type Pipeline = (typeof PIPELINES)[number]

export const STAGE_CATEGORIES = ['aberto', 'negociacao', 'ganho', 'perdido'] as const
export type StageCategory = (typeof STAGE_CATEGORIES)[number]

export const LEAD_SOURCES = ['site', 'instagram', 'whatsapp', 'telefone', 'indicacao', 'portal', 'outro'] as const
export type LeadSource = (typeof LEAD_SOURCES)[number]

export const ACTIVITY_TYPES = [
  'nota', 'ligacao', 'whatsapp', 'email', 'visita', 'reuniao', 'mudanca_etapa', 'sistema',
] as const
export type ActivityType = (typeof ACTIVITY_TYPES)[number]
/** Tipos que o usuário pode registrar manualmente. */
export const MANUAL_ACTIVITY_TYPES = ['nota', 'ligacao', 'whatsapp', 'email'] as const satisfies readonly ActivityType[]

export const APPOINTMENT_TYPES = ['visita', 'reuniao', 'outro'] as const
export type AppointmentType = (typeof APPOINTMENT_TYPES)[number]

export const APPOINTMENT_STATUSES = ['agendado', 'realizado', 'cancelado'] as const
export type AppointmentStatus = (typeof APPOINTMENT_STATUSES)[number]

export type Profile = {
  id: string
  full_name: string
  email: string
  phone: string | null
  role: AppRole
  is_active: boolean
  /** Preferências pessoais (ex.: ações rápidas do painel). Ausente se a migration ainda não foi aplicada. */
  preferences?: UserPreferences | null
  created_at: string
  updated_at: string
}

export type UserPreferences = {
  quick_actions?: string[]
}

export type TeamMember = Pick<Profile, 'id' | 'full_name' | 'email' | 'role'>

export type PipelineStage = {
  id: string
  pipeline: Pipeline
  name: string
  position: number
  category: StageCategory
  is_active: boolean
}

export type Paginated<T> = {
  rows: T[]
  count: number
}
