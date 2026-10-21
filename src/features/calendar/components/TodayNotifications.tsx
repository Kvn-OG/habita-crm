import { useQuery } from '@tanstack/react-query'
import { Bell, BellRing, CalendarClock, ClipboardCheck } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '@/auth/AuthContext'
import { useToast } from '@/components/feedback/Toast'
import { Button, IconButton } from '@/components/ui/Button'
import { Popover } from '@/components/ui/Popover'
import { formatTime } from '@/lib/format'
import { cn } from '@/lib/utils'
import { fetchToday, markNotified, REMINDER_MINUTES, showSystemNotification, todayKeys, type TodayItem } from '../today'

function permissionState() {
  return typeof Notification === 'undefined' ? 'unsupported' : Notification.permission
}

function summary(items: TodayItem[]) {
  const appointments = items.filter((item) => item.kind === 'appointment').length
  const tasks = items.length - appointments
  const parts = [
    appointments ? `${appointments} compromisso${appointments > 1 ? 's' : ''}` : null,
    tasks ? `${tasks} tarefa${tasks > 1 ? 's' : ''}` : null,
  ].filter(Boolean)
  return `Hoje você tem ${parts.join(' e ')}`
}

/**
 * Sino do cabeçalho: compromissos e tarefas de HOJE do usuário.
 * Avisa uma vez por dia ao abrir o CRM e lembra cada compromisso alguns minutos antes
 * (no CRM e, se autorizado, também como notificação do navegador).
 */
export function TodayNotifications() {
  const { profile } = useAuth()
  const toast = useToast()
  const userId = profile?.id ?? ''
  const [permission, setPermission] = useState(permissionState)
  const [now, setNow] = useState(() => Date.now())

  const query = useQuery({
    queryKey: todayKeys.list(userId),
    queryFn: () => fetchToday(userId),
    enabled: Boolean(userId),
    refetchInterval: 5 * 60_000,
    refetchOnWindowFocus: true,
  })
  const items = useMemo(() => query.data ?? [], [query.data])

  // Relógio de 30 s: atualiza o que já passou e dispara os lembretes.
  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 30_000)
    return () => window.clearInterval(interval)
  }, [])

  // Resumo do dia, uma vez por dia.
  useEffect(() => {
    if (!userId || !query.isSuccess || items.length === 0) return
    if (!markNotified(userId, 'resumo-do-dia')) return
    const first = items.find((item) => new Date(item.at).getTime() >= Date.now()) ?? items[0]
    const detail = first ? `Próximo: ${first.title} às ${formatTime(first.at)}.` : undefined
    toast.info(summary(items), detail)
    showSystemNotification(summary(items), detail ?? '', '/agenda')
  }, [userId, query.isSuccess, items, toast])

  // Lembrete de cada compromisso pouco antes do horário.
  useEffect(() => {
    if (!userId) return
    for (const item of items) {
      if (item.kind !== 'appointment') continue
      const minutes = (new Date(item.at).getTime() - now) / 60_000
      if (minutes < 0 || minutes > REMINDER_MINUTES) continue
      if (!markNotified(userId, `lembrete-${item.id}`)) continue
      const title = `Em ${Math.max(1, Math.round(minutes))} min: ${item.title}`
      toast.info(title, [formatTime(item.at), item.subtitle].filter(Boolean).join(' · '))
      showSystemNotification(title, [formatTime(item.at), item.subtitle].filter(Boolean).join(' · '), item.href)
    }
  }, [userId, items, now, toast])

  const pending = items.filter((item) => item.kind === 'task' || new Date(item.at).getTime() >= now)

  const enableBrowser = async () => {
    if (typeof Notification === 'undefined') return
    setPermission(await Notification.requestPermission())
  }

  return (
    <Popover
      trigger={({ open, toggle, id }) => (
        <div className="relative">
          <IconButton
            label={pending.length ? `Notificações: ${pending.length} item(ns) para hoje` : 'Notificações'}
            size="icon"
            onClick={toggle}
            aria-expanded={open}
            aria-controls={id}
          >
            {pending.length ? <BellRing /> : <Bell />}
          </IconButton>
          {pending.length > 0 && (
            <span
              className="pointer-events-none absolute top-1 right-1 grid min-w-4 place-items-center rounded-full bg-danger-600 px-1 text-[10px] leading-4 font-semibold text-white tabular"
              aria-hidden="true"
            >
              {pending.length > 9 ? '9+' : pending.length}
            </span>
          )}
        </div>
      )}
      className="w-80"
    >
      {(close) => (
        <div>
          <div className="px-2.5 pt-1.5 pb-2">
            <p className="text-[13px] font-semibold text-ink">Hoje</p>
            <p className="text-xs text-muted">{items.length ? summary(items) : 'Seus compromissos e tarefas do dia aparecem aqui.'}</p>
          </div>
          {query.isLoading ? (
            <p className="px-2.5 py-3 text-xs text-muted">Carregando…</p>
          ) : query.isError ? (
            <p className="px-2.5 py-3 text-xs text-danger-700">Não foi possível carregar a agenda de hoje.</p>
          ) : items.length === 0 ? (
            <p className="px-2.5 py-3 text-xs text-muted">Nada agendado para hoje.</p>
          ) : (
            <ul className="space-y-0.5">
              {items.map((item) => {
                const past = item.kind === 'appointment' && new Date(item.at).getTime() < now
                return (
                  <li key={`${item.kind}-${item.id}`}>
                    <Link
                      to={item.href}
                      onClick={close}
                      className={cn('flex items-start gap-2.5 rounded-md px-2.5 py-2 transition-colors hover:bg-hover', past && 'opacity-60')}
                    >
                      <span className="mt-0.5 w-11 shrink-0 text-[13px] font-semibold text-brand-900 tabular">{formatTime(item.at)}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13px] font-medium text-ink">{item.title}</span>
                        {item.subtitle && <span className="block truncate text-xs text-muted">{item.subtitle}</span>}
                      </span>
                      {item.kind === 'task' ? (
                        <ClipboardCheck className="mt-0.5 size-4 shrink-0 text-subtle" aria-label="Tarefa" />
                      ) : (
                        <CalendarClock className="mt-0.5 size-4 shrink-0 text-accent-600" aria-label="Compromisso" />
                      )}
                    </Link>
                  </li>
                )
              })}
            </ul>
          )}
          <div className="mt-1 border-t border-line px-2.5 pt-2 pb-1">
            {permission === 'default' ? (
              <Button size="sm" variant="secondary" className="w-full" icon={<BellRing />} onClick={() => void enableBrowser()}>
                Ativar avisos no navegador
              </Button>
            ) : (
              <p className="text-[11px] leading-relaxed text-subtle">
                {permission === 'granted'
                  ? `Você recebe um aviso do navegador ${REMINDER_MINUTES} minutos antes de cada compromisso enquanto o CRM estiver aberto.`
                  : permission === 'denied'
                    ? 'Os avisos do navegador estão bloqueados. Libere nas configurações do site para recebê-los.'
                    : `Os lembretes aparecem aqui no CRM ${REMINDER_MINUTES} minutos antes de cada compromisso.`}
              </p>
            )}
          </div>
        </div>
      )}
    </Popover>
  )
}
