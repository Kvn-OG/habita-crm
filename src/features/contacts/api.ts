import type { PickerOption } from '@/components/forms/AsyncPicker'
import { formatPhone, normalizePhone } from '@/lib/format'
import { contactTypeLabels } from '@/lib/labels'
import { getSupabase } from '@/lib/supabase'
import { range, sanitizeSearchTerm } from '@/lib/utils'
import type { Paginated } from '@/types/domain'
import type { ContactFormValues } from './schema'
import { toContactPayload } from './schema'
import type { Contact, ContactDetail, ContactFilters, ContactLead, DuplicateMatch, OwnedProperty } from './types'

export const CONTACTS_PAGE_SIZE = 15

export const contactKeys = {
  all: ['contacts'] as const,
  list: (filters: ContactFilters, page: number) => ['contacts', 'list', filters, page] as const,
  detail: (id: string) => ['contacts', 'detail', id] as const,
  leads: (id: string) => ['contacts', 'leads', id] as const,
  properties: (id: string) => ['contacts', 'properties', id] as const,
}

const COLUMNS = 'id,full_name,phone,whatsapp,email,contact_type,notes,created_by,created_at,updated_at'

export async function listContacts(filters: ContactFilters, page: number): Promise<Paginated<Contact>> {
  let query = getSupabase().from('contacts').select(COLUMNS, { count: 'exact' })
  const term = sanitizeSearchTerm(filters.q)
  if (term) {
    const digits = normalizePhone(term)
    const clauses = [`full_name.ilike.%${term}%`, `email.ilike.%${term}%`]
    if (digits.length >= 3) clauses.push(`phone.ilike.%${digits}%`, `whatsapp.ilike.%${digits}%`)
    query = query.or(clauses.join(','))
  }
  if (filters.tipo) query = query.eq('contact_type', filters.tipo)
  const [from, to] = range(page, CONTACTS_PAGE_SIZE)
  const { data, count, error } = await query.order('created_at', { ascending: false }).range(from, to)
  if (error) throw error
  return { rows: (data ?? []) as Contact[], count: count ?? 0 }
}

export async function getContact(id: string): Promise<ContactDetail> {
  const { data, error } = await getSupabase()
    .from('contacts')
    .select(`${COLUMNS}, creator:profiles!contacts_created_by_fkey(full_name)`)
    .eq('id', id)
    .single()
  if (error) throw error
  const { creator, ...contact } = data as unknown as Contact & { creator: { full_name: string } | null }
  return { ...contact, creator_name: creator?.full_name || null }
}

/**
 * Procura contatos que já usam o mesmo telefone, WhatsApp ou e-mail.
 * O banco também impede duplicidade de telefone e e-mail (índices únicos).
 */
export async function findDuplicateContacts(
  values: Pick<ContactFormValues, 'phone' | 'whatsapp' | 'whatsapp_same' | 'email'>,
  excludeId?: string,
): Promise<DuplicateMatch[]> {
  const payload = toContactPayload({ ...values, full_name: 'x', contact_type: 'outro', notes: '' })
  const numbers = [payload.phone, payload.whatsapp].filter((value): value is string => Boolean(value && value.length >= 10))
  const clauses = numbers.flatMap((number) => [`phone.eq.${number}`, `whatsapp.eq.${number}`])
  if (payload.email) clauses.push(`email.eq."${payload.email.replace(/"/g, '')}"`)
  if (clauses.length === 0) return []

  let query = getSupabase().from('contacts').select('id,full_name,phone,whatsapp,email').or(clauses.join(',')).limit(5)
  if (excludeId) query = query.neq('id', excludeId)
  const { data, error } = await query
  if (error) throw error

  return ((data ?? []) as Pick<Contact, 'id' | 'full_name' | 'phone' | 'whatsapp' | 'email'>[]).map((match) => {
    const reasons: string[] = []
    if (numbers.some((number) => number === match.phone || number === match.whatsapp)) reasons.push('telefone/WhatsApp')
    if (payload.email && match.email === payload.email) reasons.push('e-mail')
    return { id: match.id, full_name: match.full_name, phone: match.phone, email: match.email, reasons }
  })
}

export async function createContact(values: ContactFormValues) {
  const { data, error } = await getSupabase().from('contacts').insert(toContactPayload(values)).select(COLUMNS).single()
  if (error) throw error
  return data as Contact
}

export async function updateContact(id: string, values: ContactFormValues) {
  const { data, error } = await getSupabase().from('contacts').update(toContactPayload(values)).eq('id', id).select(COLUMNS).single()
  if (error) throw error
  return data as Contact
}

export async function deleteContact(id: string) {
  const supabase = getSupabase()
  // Remove o cadastro de proprietário sem imóveis vinculados antes de excluir o contato.
  const { data: owner } = await supabase.from('owners').select('id, property_owners(property_id)').eq('contact_id', id).maybeSingle()
  const ownerRow = owner as { id: string; property_owners: unknown[] } | null
  if (ownerRow && ownerRow.property_owners.length > 0) {
    throw new Error('Este contato é proprietário de imóveis. Remova-o dos imóveis antes de excluir.')
  }
  if (ownerRow) {
    const { error: ownerError } = await supabase.from('owners').delete().eq('id', ownerRow.id)
    if (ownerError) throw ownerError
  }
  const { error, count } = await supabase.from('contacts').delete({ count: 'exact' }).eq('id', id)
  if (error) throw error
  if (count === 0) throw new Error('Você não tem permissão para excluir este contato.')
}

export async function listContactLeads(contactId: string): Promise<ContactLead[]> {
  const { data, error } = await getSupabase()
    .from('lead_overview')
    .select('id,purpose,stage_name,stage_category,desired_region,next_follow_up_at,created_at')
    .eq('contact_id', contactId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as ContactLead[]
}

export async function listOwnedProperties(contactId: string): Promise<OwnedProperty[]> {
  const { data, error } = await getSupabase()
    .from('owners')
    .select('property_owners(properties(id,code,title,status))')
    .eq('contact_id', contactId)
    .maybeSingle()
  if (error) throw error
  const rows = (data as { property_owners: { properties: OwnedProperty | null }[] } | null)?.property_owners ?? []
  return rows.map((row) => row.properties).filter((property): property is OwnedProperty => Boolean(property))
}

export function contactToOption(contact: Pick<Contact, 'id' | 'full_name' | 'phone' | 'contact_type'>): PickerOption {
  return {
    id: contact.id,
    label: contact.full_name,
    description: `${formatPhone(contact.phone)} · ${contactTypeLabels[contact.contact_type]}`,
  }
}

export async function searchContactOptions(term: string): Promise<PickerOption[]> {
  let query = getSupabase().from('contacts').select('id,full_name,phone,contact_type').order('full_name').limit(12)
  const clean = sanitizeSearchTerm(term)
  if (clean) {
    const digits = normalizePhone(clean)
    query = digits.length >= 3
      ? query.or(`full_name.ilike.%${clean}%,phone.ilike.%${digits}%`)
      : query.ilike('full_name', `%${clean}%`)
  }
  const { data, error } = await query
  if (error) throw error
  return ((data ?? []) as Pick<Contact, 'id' | 'full_name' | 'phone' | 'contact_type'>[]).map(contactToOption)
}
