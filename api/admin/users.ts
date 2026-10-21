/**
 * Gestão de acessos do Habita (Vercel Function — roda apenas no servidor).
 *
 * Usa a chave service_role do Supabase, disponível SOMENTE no ambiente da Vercel
 * (variável SUPABASE_SERVICE_ROLE_KEY, nunca exposta ao navegador).
 * Cada requisição precisa do token de sessão de um ADMINISTRADOR ATIVO.
 *
 * POST /api/admin/users
 *   { action: "create", email, full_name, role, password }
 *   { action: "reset_password", user_id, password }
 *   { action: "delete", user_id }  (os registros da pessoa são mantidos, sem autor/responsável)
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { z } from 'zod'

const ROLES = ['admin', 'corretor'] as const

const password = z
  .string()
  .min(8, 'A senha deve ter pelo menos 8 caracteres.')
  .max(72, 'A senha deve ter no máximo 72 caracteres.')
  .regex(/[A-Za-z]/, 'A senha deve ter pelo menos uma letra.')
  .regex(/\d/, 'A senha deve ter pelo menos um número.')

const createSchema = z.object({
  action: z.literal('create'),
  email: z.string().trim().toLowerCase().pipe(z.email('Informe um e-mail válido.')),
  full_name: z.string().trim().min(2, 'Informe o nome completo.').max(120),
  role: z.enum(ROLES),
  password,
})

const resetSchema = z.object({
  action: z.literal('reset_password'),
  user_id: z.uuid('Usuário inválido.'),
  password,
})

const deleteSchema = z.object({
  action: z.literal('delete'),
  user_id: z.uuid('Usuário inválido.'),
})

const bodySchema = z.discriminatedUnion('action', [createSchema, resetSchema, deleteSchema])

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  })
}

function adminClient(): SupabaseClient | null {
  const url = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
}

function translate(message: string) {
  if (/already been registered|already registered|already exists/i.test(message)) return 'Já existe um acesso com este e-mail.'
  if (/password/i.test(message) && /weak|short|characters/i.test(message)) return 'A senha não atende aos requisitos de segurança.'
  return message
}

export async function POST(request: Request): Promise<Response> {
  const admin = adminClient()
  if (!admin) return json(500, { error: 'A gestão de acessos não está configurada no servidor.' })

  // 1. Quem está chamando? (token da sessão do navegador)
  const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
  if (!token) return json(401, { error: 'Sessão ausente. Entre novamente.' })
  const { data: caller, error: callerError } = await admin.auth.getUser(token)
  if (callerError || !caller.user) return json(401, { error: 'Sua sessão expirou. Entre novamente.' })

  // 2. É um administrador ativo?
  const { data: callerProfile } = await admin.from('profiles').select('role,is_active').eq('id', caller.user.id).maybeSingle()
  if (!callerProfile || callerProfile.role !== 'admin' || !callerProfile.is_active) {
    return json(403, { error: 'Apenas administradores podem gerenciar acessos.' })
  }

  // 3. Validação do pedido
  let payload: unknown
  try {
    payload = await request.json()
  } catch {
    return json(400, { error: 'Requisição inválida.' })
  }
  const parsed = bodySchema.safeParse(payload)
  if (!parsed.success) return json(400, { error: parsed.error.issues[0]?.message ?? 'Dados inválidos.' })
  const body = parsed.data

  if (body.action === 'reset_password') {
    const { data: target } = await admin.from('profiles').select('id').eq('id', body.user_id).maybeSingle()
    if (!target) return json(404, { error: 'Usuário não encontrado.' })
    const { error } = await admin.auth.admin.updateUserById(body.user_id, {
      password: body.password,
      user_metadata: { must_change_password: true },
    })
    if (error) return json(400, { error: translate(error.message) })
    return json(200, { ok: true })
  }

  if (body.action === 'delete') {
    if (body.user_id === caller.user.id) return json(400, { error: 'Você não pode excluir o seu próprio acesso.' })
    const { data: target } = await admin.from('profiles').select('id').eq('id', body.user_id).maybeSingle()
    if (!target) return json(404, { error: 'Usuário não encontrado.' })
    // Foto de perfil é removida junto; os registros comerciais ficam no CRM.
    const { data: files } = await admin.storage.from('avatars').list(body.user_id)
    if (files?.length) await admin.storage.from('avatars').remove(files.map((file) => `${body.user_id}/${file.name}`))
    const { error } = await admin.auth.admin.deleteUser(body.user_id)
    if (error) return json(400, { error: translate(error.message) })
    return json(200, { ok: true })
  }

  // Criação do acesso
  const created = await admin.auth.admin.createUser({
    email: body.email,
    password: body.password,
    email_confirm: true,
    user_metadata: { full_name: body.full_name, must_change_password: true },
  })
  if (created.error || !created.data.user) return json(400, { error: translate(created.error?.message ?? 'Não foi possível criar o acesso.') })

  const userId = created.data.user.id
  // O perfil é criado pelo trigger do banco; aqui definimos papel e liberamos o acesso.
  const { error: profileError } = await admin
    .from('profiles')
    .update({ full_name: body.full_name, role: body.role, is_active: true })
    .eq('id', userId)
  if (profileError) return json(500, { error: `Acesso criado, mas não foi possível definir o papel: ${profileError.message}` })

  return json(201, { ok: true, user_id: userId })
}
