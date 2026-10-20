import type { ContactType } from '@/types/domain'

export type Contact = {
  id: string
  full_name: string
  phone: string
  whatsapp: string | null
  email: string | null
  contact_type: ContactType
  notes: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

export type ContactDetail = Contact & { creator_name: string | null }

export type ContactFilters = {
  q: string
  tipo: string
}

export type DuplicateMatch = {
  id: string
  full_name: string
  phone: string
  email: string | null
  reasons: string[]
}

export type ContactLead = {
  id: string
  purpose: 'venda' | 'locacao'
  stage_name: string
  stage_category: 'aberto' | 'negociacao' | 'ganho' | 'perdido'
  desired_region: string | null
  next_follow_up_at: string | null
  created_at: string
}

export type OwnedProperty = {
  id: string
  code: string
  title: string
  status: import('@/types/domain').PropertyStatus
}
