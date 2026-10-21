import type { PickerOption } from '@/components/forms/AsyncPicker'
import { formatCurrency } from '@/lib/format'
import { propertyTypeLabels } from '@/lib/labels'
import { getSupabase, PROPERTY_IMAGES_BUCKET } from '@/lib/supabase'
import { range, sanitizeSearchTerm } from '@/lib/utils'
import type { Paginated } from '@/types/domain'
import { extensionFor, MAX_IMAGE_BYTES, prepareImage, validateImageFile } from './images'
import type { PropertyFormValues } from './schema'
import { toPropertyPayload } from './schema'
import type {
  Property, PropertyDetail, PropertyFilters, PropertyImage, PropertyInterestedLead, PropertyListItem, PropertyOwnerContact,
} from './types'

export const PROPERTIES_PAGE_SIZE = 15

export const propertyKeys = {
  all: ['properties'] as const,
  list: (filters: PropertyFilters, page: number) => ['properties', 'list', filters, page] as const,
  detail: (id: string) => ['properties', 'detail', id] as const,
  images: (id: string) => ['properties', 'images', id] as const,
  leads: (id: string) => ['properties', 'leads', id] as const,
}

const LIST_COLUMNS =
  'id,code,title,property_type,purpose,status,neighborhood,city,state,sale_price,rent_price,bedrooms,built_area,created_at'

export async function listProperties(filters: PropertyFilters, page: number): Promise<Paginated<PropertyListItem>> {
  let query = getSupabase().from('properties').select(LIST_COLUMNS, { count: 'exact' })

  const term = sanitizeSearchTerm(filters.q)
  if (term) {
    const pattern = `%${term}%`
    query = query.or(
      `code.ilike.${pattern},title.ilike.${pattern},neighborhood.ilike.${pattern},city.ilike.${pattern}`,
    )
  }
  if (filters.finalidade) {
    // Imóveis "venda e locação" aparecem tanto no filtro de venda quanto no de locação.
    query = filters.finalidade === 'ambos'
      ? query.eq('purpose', 'ambos')
      : query.in('purpose', [filters.finalidade, 'ambos'])
  }
  if (filters.tipo) query = query.eq('property_type', filters.tipo)
  if (filters.situacao) query = query.eq('status', filters.situacao)

  const [from, to] = range(page, PROPERTIES_PAGE_SIZE)
  const { data, count, error } = await query.order('created_at', { ascending: false }).range(from, to)
  if (error) throw error
  return { rows: (data ?? []) as PropertyListItem[], count: count ?? 0 }
}

type OwnerRow = { owners: { contacts: PropertyOwnerContact | null } | null }

export async function getProperty(id: string): Promise<PropertyDetail> {
  const { data, error } = await getSupabase()
    .from('properties')
    .select('*, creator:profiles!properties_created_by_fkey(full_name), property_owners(owners(contacts(id,full_name,phone,email)))')
    .eq('id', id)
    .single()
  if (error) throw error

  const { property_owners: ownerRows, creator, ...property } = data as Property & {
    property_owners: OwnerRow[]
    creator: { full_name: string } | null
  }
  const owners = (ownerRows ?? [])
    .map((row) => row.owners?.contacts)
    .filter((contact): contact is PropertyOwnerContact => Boolean(contact))
    .sort((a, b) => a.full_name.localeCompare(b.full_name, 'pt-BR'))

  return { ...property, owners, creator_name: creator?.full_name || null }
}

/** Cadastra o imóvel; o código (IM-0001…) é gerado pelo banco e devolvido. */
export async function createProperty(values: PropertyFormValues, ownerContactIds: string[]) {
  const supabase = getSupabase()
  const { data, error } = await supabase.from('properties').insert(toPropertyPayload(values)).select('id,code').single()
  if (error) throw error
  const created = data as { id: string; code: string }
  await setPropertyOwners(created.id, ownerContactIds)
  return created
}

export async function updateProperty(id: string, values: PropertyFormValues, ownerContactIds: string[]) {
  const { error } = await getSupabase().from('properties').update(toPropertyPayload(values)).eq('id', id)
  if (error) throw error
  await setPropertyOwners(id, ownerContactIds)
}

async function setPropertyOwners(propertyId: string, contactIds: string[]) {
  const { error } = await getSupabase().rpc('set_property_owners', {
    p_property_id: propertyId,
    p_contact_ids: contactIds,
  })
  if (error) throw error
}

/** Exclui as fotos do Storage e depois o imóvel (vínculos são removidos em cascata). */
export async function deleteProperty(id: string) {
  const supabase = getSupabase()
  const { data: images, error: listError } = await supabase.from('property_images').select('storage_path').eq('property_id', id)
  if (listError) throw listError
  const paths = (images ?? []).map((image) => (image as { storage_path: string }).storage_path)
  if (paths.length) {
    const { error: storageError } = await supabase.storage.from(PROPERTY_IMAGES_BUCKET).remove(paths)
    if (storageError) throw storageError
  }
  const { error, count } = await supabase.from('properties').delete({ count: 'exact' }).eq('id', id)
  if (error) throw error
  if (count === 0) throw new Error('Você não tem permissão para excluir este imóvel.')
}

// ---------------------------------------------------------------------------
// Fotos
// ---------------------------------------------------------------------------

export async function listPropertyImages(propertyId: string): Promise<PropertyImage[]> {
  const supabase = getSupabase()
  const { data, error } = await supabase
    .from('property_images')
    .select('id,property_id,storage_path,position,caption,created_by,created_at')
    .eq('property_id', propertyId)
    .order('position')
    .order('created_at')
  if (error) throw error
  const images = (data ?? []) as PropertyImage[]
  if (images.length === 0) return images

  const { data: signed, error: signError } = await supabase.storage
    .from(PROPERTY_IMAGES_BUCKET)
    .createSignedUrls(images.map((image) => image.storage_path), 60 * 60)
  if (signError) throw signError
  const urlByPath = new Map((signed ?? []).map((item) => [item.path, item.signedUrl]))
  return images.map((image) => ({ ...image, url: urlByPath.get(image.storage_path) ?? undefined }))
}

export type UploadResult = { uploaded: number; errors: string[] }

export async function uploadPropertyImages(propertyId: string, files: File[], startPosition: number): Promise<UploadResult> {
  const supabase = getSupabase()
  const errors: string[] = []
  let uploaded = 0

  for (const [index, original] of files.entries()) {
    const validation = validateImageFile(original)
    if (validation) {
      errors.push(validation)
      continue
    }
    const file = await prepareImage(original)
    if (file.size > MAX_IMAGE_BYTES) {
      errors.push(`"${original.name}" continua acima de 5 MB após a otimização.`)
      continue
    }

    const path = `properties/${propertyId}/${crypto.randomUUID()}.${extensionFor(file.type)}`
    const { error: uploadError } = await supabase.storage
      .from(PROPERTY_IMAGES_BUCKET)
      .upload(path, file, { contentType: file.type, upsert: false, cacheControl: '3600' })
    if (uploadError) {
      errors.push(`Falha ao enviar "${original.name}": ${uploadError.message}`)
      continue
    }

    const { error: insertError } = await supabase.from('property_images').insert({
      property_id: propertyId,
      storage_path: path,
      position: startPosition + index,
      mime_type: file.type,
      file_size: file.size,
    })
    if (insertError) {
      await supabase.storage.from(PROPERTY_IMAGES_BUCKET).remove([path])
      errors.push(`Falha ao registrar "${original.name}".`)
      continue
    }
    uploaded += 1
  }

  return { uploaded, errors }
}

export async function deletePropertyImage(image: PropertyImage) {
  const supabase = getSupabase()
  const { error: storageError } = await supabase.storage.from(PROPERTY_IMAGES_BUCKET).remove([image.storage_path])
  if (storageError) throw storageError
  const { error, count } = await supabase.from('property_images').delete({ count: 'exact' }).eq('id', image.id)
  if (error) throw error
  if (count === 0) throw new Error('Você só pode excluir fotos que enviou. Administradores podem excluir qualquer foto.')
}

/** Define a foto de capa (posição 0) reordenando as demais. */
export async function setCoverImage(images: PropertyImage[], coverId: string) {
  const ordered = [...images.filter((image) => image.id === coverId), ...images.filter((image) => image.id !== coverId)]
  const supabase = getSupabase()
  const results = await Promise.all(
    ordered.map((image, position) => supabase.from('property_images').update({ position }).eq('id', image.id)),
  )
  const failed = results.find((result) => result.error)
  if (failed?.error) throw failed.error
}

// ---------------------------------------------------------------------------
// Relacionamentos e utilitários
// ---------------------------------------------------------------------------

export async function listPropertyInterestedLeads(propertyId: string): Promise<PropertyInterestedLead[]> {
  const supabase = getSupabase()
  const { data: links, error } = await supabase.from('lead_properties').select('lead_id').eq('property_id', propertyId)
  if (error) throw error
  const ids = (links ?? []).map((link) => (link as { lead_id: string }).lead_id)
  if (ids.length === 0) return []
  const { data, error: leadsError } = await supabase
    .from('lead_overview')
    .select('id,purpose,contact_name,stage_name,stage_category')
    .in('id', ids)
    .order('created_at', { ascending: false })
  if (leadsError) throw leadsError
  return (data ?? []) as PropertyInterestedLead[]
}

export async function searchPropertyOptions(term: string): Promise<PickerOption[]> {
  let query = getSupabase()
    .from('properties')
    .select('id,code,title,property_type,neighborhood,sale_price,rent_price')
    .order('code')
    .limit(12)
  const clean = sanitizeSearchTerm(term)
  if (clean) query = query.or(`code.ilike.%${clean}%,title.ilike.%${clean}%,neighborhood.ilike.%${clean}%`)
  const { data, error } = await query
  if (error) throw error
  return (data ?? []).map((row) => {
    const property = row as Pick<Property, 'id' | 'code' | 'title' | 'property_type' | 'neighborhood' | 'sale_price' | 'rent_price'>
    const price = property.sale_price ?? property.rent_price
    return {
      id: property.id,
      label: `${property.code} · ${property.title}`,
      description: [propertyTypeLabels[property.property_type], property.neighborhood, price !== null ? formatCurrency(price) : null]
        .filter(Boolean)
        .join(' · '),
    }
  })
}

export const PROPERTY_CODE_PREFIX = 'IM-'

/** Próximo código sequencial (IM-0001, IM-0002…), mesma regra usada pelo banco ao cadastrar. */
export function nextPropertyCode(existing: string[]) {
  const pattern = new RegExp(`^${PROPERTY_CODE_PREFIX}(\\d+)$`)
  const max = existing.reduce((highest, code) => {
    const match = pattern.exec(code.trim().toUpperCase())
    return match ? Math.max(highest, Number(match[1])) : highest
  }, 0)
  return `${PROPERTY_CODE_PREFIX}${String(max + 1).padStart(4, '0')}`
}

/** Prévia do código exibida no cadastro; o valor final é definido pelo banco ao salvar. */
export async function suggestPropertyCode() {
  const { data, error } = await getSupabase()
    .from('properties')
    .select('code')
    .filter('code', 'match', `^${PROPERTY_CODE_PREFIX}[0-9]+$`)
  if (error) throw error
  return nextPropertyCode(((data ?? []) as { code: string }[]).map((row) => row.code))
}
