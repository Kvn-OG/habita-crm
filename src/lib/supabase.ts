import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL?.trim()
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim()

function isValidUrl(value: string | undefined): value is string {
  if (!value) return false
  try {
    const parsed = new URL(value)
    return parsed.protocol === 'https:' || parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1'
  } catch {
    return false
  }
}

export const isSupabaseConfigured = isValidUrl(url) && Boolean(anonKey) && !anonKey?.includes('sua-chave')

export const PROPERTY_IMAGES_BUCKET = 'property-images'

const client: SupabaseClient | null = isSupabaseConfigured
  ? createClient(url as string, anonKey as string, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        flowType: 'pkce',
      },
    })
  : null

export class SupabaseNotConfiguredError extends Error {
  constructor() {
    super('A integração com o Supabase não está configurada.')
    this.name = 'SupabaseNotConfiguredError'
  }
}

/** Retorna o cliente Supabase. A aplicação só renderiza rotas de dados quando ele está configurado. */
export function getSupabase(): SupabaseClient {
  if (!client) throw new SupabaseNotConfiguredError()
  return client
}
