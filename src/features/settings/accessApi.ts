import { getSupabase } from '@/lib/supabase'
import type { AppRole } from '@/types/domain'

export type CreateAccessInput = {
  email: string
  full_name: string
  role: AppRole
  mode: 'password' | 'invite'
  password?: string
}

/** Chama a função de servidor /api/admin/users com o token da sessão atual. */
async function callAdmin(body: Record<string, unknown>) {
  const { data } = await getSupabase().auth.getSession()
  const token = data.session?.access_token
  if (!token) throw new Error('Sua sessão expirou. Entre novamente.')

  let response: Response
  try {
    response = await fetch('/api/admin/users', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
    })
  } catch {
    throw new Error('Falha de conexão. Verifique sua internet e tente novamente.')
  }

  const result = (await response.json().catch(() => null)) as { error?: string; user_id?: string } | null
  if (response.status === 404 && !result) {
    throw new Error('A gestão de acessos funciona na versão publicada do Habita (ou com "vercel dev" no computador).')
  }
  if (!response.ok) throw new Error(result?.error ?? 'Não foi possível concluir a operação.')
  return result
}

export function createAccess(input: CreateAccessInput) {
  return callAdmin({ action: 'create', ...input })
}

export function resetMemberPassword(userId: string, password: string) {
  return callAdmin({ action: 'reset_password', user_id: userId, password })
}

/** Senha provisória forte e fácil de ditar (sem caracteres ambíguos como 0/O, 1/l). */
export function generateTemporaryPassword() {
  const letters = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ'
  const digits = '23456789'
  const pick = (chars: string, count: number) => {
    const values = crypto.getRandomValues(new Uint32Array(count))
    return Array.from(values, (value) => chars[value % chars.length]).join('')
  }
  return `Habita-${pick(letters, 4)}${pick(digits, 2)}${pick(letters, 2)}${pick(digits, 2)}`
}
