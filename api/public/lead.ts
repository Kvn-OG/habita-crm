/**
 * Recebimento de leads das landing pages (Vercel Function — roda apenas no servidor).
 *
 * Cada landing page cadastrada em Marketing → Landing Pages tem um identificador
 * (token). O formulário da página envia os dados para cá e o lead entra no funil.
 *
 * POST /api/public/lead
 *   JSON ou formulário HTML comum (application/x-www-form-urlencoded) com:
 *   token, nome, telefone, email?, mensagem?, utm_source?, utm_medium?,
 *   utm_campaign?, utm_content?, utm_term?, redirect? (página de obrigado),
 *   website (campo-armadilha: deve ficar vazio; robôs costumam preenchê-lo).
 */
import { createClient } from '@supabase/supabase-js'
import { z } from 'zod'

const UTM_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'] as const

const text = (max: number) => z.string().trim().max(max).optional().default('')

const bodySchema = z.object({
  token: z.string().trim().regex(/^[0-9a-f]{64}$/, 'Landing page inválida.'),
  nome: z.string().trim().min(2, 'Informe o nome.').max(160),
  telefone: z.string().trim().min(10, 'Informe um telefone com DDD.').max(30),
  email: text(160),
  mensagem: text(2000),
  website: text(200),
  redirect: text(500),
  utm_source: text(200),
  utm_medium: text(200),
  utm_campaign: text(200),
  utm_content: text(200),
  utm_term: text(200),
})

const corsHeaders = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'POST, OPTIONS',
  'access-control-allow-headers': 'content-type',
  'access-control-max-age': '86400',
}

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...corsHeaders },
  })
}

/** Formulário HTML sem JavaScript: volta para a página de obrigado informada. */
function redirectTo(url: string) {
  return new Response(null, { status: 303, headers: { location: url, 'cache-control': 'no-store', ...corsHeaders } })
}

function safeRedirect(value: string) {
  try {
    const url = new URL(value)
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.toString() : null
  } catch {
    return null
  }
}

async function readBody(request: Request): Promise<{ data: Record<string, unknown>; isForm: boolean } | null> {
  const type = request.headers.get('content-type') ?? ''
  try {
    if (type.includes('application/json')) return { data: (await request.json()) as Record<string, unknown>, isForm: false }
    if (type.includes('application/x-www-form-urlencoded') || type.includes('multipart/form-data')) {
      const form = await request.formData()
      return { data: Object.fromEntries([...form.entries()].map(([key, value]) => [key, String(value)])), isForm: true }
    }
  } catch {
    return null
  }
  return null
}

export function OPTIONS(): Response {
  return new Response(null, { status: 204, headers: corsHeaders })
}

export async function POST(request: Request): Promise<Response> {
  const url = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return json(500, { error: 'O recebimento de leads não está configurado no servidor.' })

  const body = await readBody(request)
  if (!body) return json(400, { error: 'Envie os dados em JSON ou por formulário.' })

  const parsed = bodySchema.safeParse(body.data)
  if (!parsed.success) return json(400, { error: parsed.error.issues[0]?.message ?? 'Dados inválidos.' })
  const values = parsed.data
  const redirect = body.isForm && values.redirect ? safeRedirect(values.redirect) : null

  // Campo-armadilha preenchido: responde como sucesso, mas não grava nada.
  if (values.website) return redirect ? redirectTo(redirect) : json(200, { ok: true })

  const utm = Object.fromEntries(UTM_KEYS.filter((name) => values[name]).map((name) => [name, values[name]]))
  const supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
  const { data, error } = await supabase.rpc('submit_landing_page_lead', {
    p_token: values.token,
    p_name: values.nome,
    p_phone: values.telefone,
    p_email: values.email || null,
    p_message: values.mensagem || null,
    p_utm: utm,
  })

  if (error) {
    // Mensagens de validação do banco já estão em português.
    const known = error.code === '22023' || error.code === 'P0002'
    return json(known ? 400 : 500, { error: known ? error.message : 'Não foi possível registrar o contato. Tente novamente.' })
  }

  const result = data as { lead_id: string; created: boolean }
  return redirect ? redirectTo(redirect) : json(200, { ok: true, created: result.created })
}
