import { normalizePhone } from '@/lib/format'
import { AVATARS_BUCKET, getSupabase } from '@/lib/supabase'
import type { AppRole, Pipeline, PipelineStage, Profile, StageCategory, UserPreferences } from '@/types/domain'

export const settingsKeys = {
  profiles: ['settings', 'profiles'] as const,
}

export async function listProfiles(): Promise<Profile[]> {
  const { data, error } = await getSupabase()
    .from('profiles')
    .select('id,full_name,email,phone,role,is_active,avatar_path,created_at,updated_at')
    .order('is_active')
    .order('full_name')
  if (error) throw error
  return (data ?? []) as Profile[]
}

export async function updateOwnProfile(id: string, values: { full_name: string; phone: string }) {
  const phone = normalizePhone(values.phone)
  const { error } = await getSupabase()
    .from('profiles')
    .update({ full_name: values.full_name.trim(), phone: phone || null })
    .eq('id', id)
  if (error) throw error
}

/** Salva as preferências pessoais, preservando as demais chaves já gravadas. */
export async function updateOwnPreferences(id: string, current: UserPreferences | null | undefined, patch: UserPreferences) {
  const { error } = await getSupabase()
    .from('profiles')
    .update({ preferences: { ...(current ?? {}), ...patch } })
    .eq('id', id)
  if (error) {
    if (/preferences/.test(error.message)) {
      throw new Error('A personalização ainda não está habilitada no banco. Peça ao administrador para aplicar a atualização mais recente.')
    }
    throw error
  }
}

/** Envia a nova foto (já preparada), aponta o perfil para ela e apaga a anterior. */
export async function uploadOwnAvatar(id: string, file: File, previousPath: string | null | undefined) {
  const supabase = getSupabase()
  const path = `${id}/${crypto.randomUUID()}.jpg`
  const { error: uploadError } = await supabase.storage
    .from(AVATARS_BUCKET)
    .upload(path, file, { contentType: file.type, upsert: false, cacheControl: '3600' })
  if (uploadError) {
    if (/bucket not found/i.test(uploadError.message)) {
      throw new Error('A foto de perfil ainda não está habilitada no banco. Peça ao administrador para aplicar a atualização mais recente.')
    }
    throw uploadError
  }
  const { error } = await supabase.from('profiles').update({ avatar_path: path }).eq('id', id)
  if (error) {
    await supabase.storage.from(AVATARS_BUCKET).remove([path])
    throw error
  }
  if (previousPath) await supabase.storage.from(AVATARS_BUCKET).remove([previousPath])
}

export async function removeOwnAvatar(id: string, path: string) {
  const supabase = getSupabase()
  const { error } = await supabase.from('profiles').update({ avatar_path: null }).eq('id', id)
  if (error) throw error
  await supabase.storage.from(AVATARS_BUCKET).remove([path])
}

export async function updateMemberAccess(id: string, patch: { role?: AppRole; is_active?: boolean }) {
  const { error, count } = await getSupabase().from('profiles').update(patch, { count: 'exact' }).eq('id', id)
  if (error) throw error
  if (count === 0) throw new Error('Apenas administradores podem alterar o acesso da equipe.')
}

export async function updateStage(id: string, patch: Partial<Pick<PipelineStage, 'name' | 'category' | 'is_active'>>) {
  const { error, count } = await getSupabase().from('pipeline_stages').update(patch, { count: 'exact' }).eq('id', id)
  if (error) throw error
  if (count === 0) throw new Error('Apenas administradores podem configurar os funis.')
}

export async function createStage(pipeline: Pipeline, name: string, category: StageCategory, position: number) {
  const { error } = await getSupabase().from('pipeline_stages').insert({ pipeline, name: name.trim(), category, position })
  if (error) throw error
}

export async function reorderStages(pipeline: Pipeline, ids: string[]) {
  const { error } = await getSupabase().rpc('reorder_pipeline_stages', { p_pipeline: pipeline, p_stage_ids: ids })
  if (error) throw error
}

export async function countLeadsInStage(stageId: string) {
  const { count, error } = await getSupabase().from('leads').select('id', { count: 'exact', head: true }).eq('stage_id', stageId)
  if (error) throw error
  return count ?? 0
}
