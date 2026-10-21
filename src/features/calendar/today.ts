import { getSupabase } from '@/lib/supabase'

/** Compromisso ou tarefa do dia de hoje sob responsabilidade do usuário. */
export type TodayItem = {
  id: string
  kind: 'appointment' | 'task'
  title: string
  at: string
  subtitle: string | null
  href: string
}

export const todayKeys = {
  list: (userId: string) => ['agenda-today', userId] as const,
}

/** Antecedência do lembrete de cada compromisso. */
export const REMINDER_MINUTES = 15

function todayBounds(now = new Date()) {
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1)
  return { start: start.toISOString(), end: end.toISOString() }
}

/** "Meu" = responsável sou eu, ou não há responsável e fui eu quem criou. */
function mine(userId: string) {
  return `assigned_to.eq.${userId},and(assigned_to.is.null,created_by.eq.${userId})`
}

export async function fetchToday(userId: string): Promise<TodayItem[]> {
  const supabase = getSupabase()
  const { start, end } = todayBounds()
  const [appointments, tasks] = await Promise.all([
    supabase
      .from('appointments')
      .select('id,title,starts_at,location,lead_id, property:properties(code)')
      .eq('status', 'agendado')
      .gte('starts_at', start)
      .lt('starts_at', end)
      .or(mine(userId))
      .order('starts_at'),
    supabase
      .from('tasks')
      .select('id,title,due_at,lead_id')
      .is('completed_at', null)
      .gte('due_at', start)
      .lt('due_at', end)
      .or(mine(userId))
      .order('due_at'),
  ])
  if (appointments.error) throw appointments.error
  if (tasks.error) throw tasks.error

  type AppointmentRow = { id: string; title: string; starts_at: string; location: string | null; lead_id: string | null; property: { code: string } | null }
  type TaskRow = { id: string; title: string; due_at: string; lead_id: string | null }

  return [
    ...((appointments.data ?? []) as unknown as AppointmentRow[]).map((row) => ({
      id: row.id,
      kind: 'appointment' as const,
      title: row.title,
      at: row.starts_at,
      subtitle: [row.property?.code, row.location].filter(Boolean).join(' · ') || null,
      href: row.lead_id ? `/leads/${row.lead_id}` : '/agenda',
    })),
    ...((tasks.data ?? []) as TaskRow[]).map((row) => ({
      id: row.id,
      kind: 'task' as const,
      title: row.title,
      at: row.due_at,
      subtitle: 'Tarefa',
      href: row.lead_id ? `/leads/${row.lead_id}` : '/agenda',
    })),
  ].sort((a, b) => a.at.localeCompare(b.at))
}

// ---------------------------------------------------------------------------
// Controle do que já foi avisado (por usuário e por dia, só neste navegador)
// ---------------------------------------------------------------------------

function dayKey(now = new Date()) {
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
}

function readSet(key: string): Set<string> {
  try {
    const raw = JSON.parse(localStorage.getItem(key) ?? 'null') as { day?: string; ids?: string[] } | null
    return new Set(raw?.day === dayKey() ? (raw.ids ?? []) : [])
  } catch {
    return new Set()
  }
}

function writeSet(key: string, ids: Set<string>) {
  try {
    localStorage.setItem(key, JSON.stringify({ day: dayKey(), ids: [...ids] }))
  } catch {
    // Armazenamento indisponível: o aviso pode se repetir ao recarregar.
  }
}

/** Marca um aviso como dado hoje; devolve false se já tinha sido dado. */
export function markNotified(userId: string, id: string) {
  const key = `habita:avisos:${userId}`
  const ids = readSet(key)
  if (ids.has(id)) return false
  ids.add(id)
  writeSet(key, ids)
  return true
}

/** Notificação do sistema operacional, quando o usuário autorizou. */
export function showSystemNotification(title: string, body: string, href: string) {
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return
  try {
    const notification = new Notification(title, { body, tag: `habita-${href}-${title}`, icon: '/apple-touch-icon.png' })
    notification.onclick = () => {
      window.focus()
      window.location.assign(href)
      notification.close()
    }
  } catch {
    // Alguns navegadores (ex.: Android) só permitem notificações por service worker.
  }
}
