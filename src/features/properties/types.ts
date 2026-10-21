import type { PropertyPurpose, PropertyStatus, PropertyType } from '@/types/domain'

export type Property = {
  id: string
  code: string
  title: string
  property_type: PropertyType
  purpose: PropertyPurpose
  status: PropertyStatus
  description: string | null
  postal_code: string | null
  state: string | null
  city: string | null
  neighborhood: string | null
  street: string | null
  street_number: string | null
  complement: string | null
  land_area: number | null
  built_area: number | null
  bedrooms: number | null
  suites: number | null
  bathrooms: number | null
  parking_spaces: number | null
  sale_price: number | null
  rent_price: number | null
  condo_fee: number | null
  iptu: number | null
  created_by: string | null
  created_at: string
  updated_at: string
}

export type PropertyListItem = Pick<
  Property,
  | 'id' | 'code' | 'title' | 'property_type' | 'purpose' | 'status' | 'neighborhood' | 'city'
  | 'state' | 'sale_price' | 'rent_price' | 'bedrooms' | 'built_area' | 'created_at'
>

export type PropertyImage = {
  id: string
  property_id: string
  storage_path: string
  position: number
  caption: string | null
  created_by: string | null
  created_at: string
  /** URL assinada e temporária para exibição. */
  url?: string
}

export type PropertyOwnerContact = {
  id: string
  full_name: string
  phone: string
  email: string | null
}

export type PropertyInterestedLead = {
  id: string
  purpose: 'venda' | 'locacao'
  contact_name: string
  stage_name: string
  stage_category: 'aberto' | 'negociacao' | 'ganho' | 'perdido'
}

export type PropertyDetail = Property & {
  owners: PropertyOwnerContact[]
  creator_name: string | null
}

export type PropertyFilters = {
  q: string
  finalidade: string
  tipo: string
  situacao: string
}
