import { CircleAlert, CircleCheck, Info, X } from 'lucide-react'
import { createContext, useCallback, useContext, useMemo, useRef, useState, type PropsWithChildren } from 'react'
import { cn } from '@/lib/utils'

type ToastTone = 'success' | 'error' | 'info'

type Toast = {
  id: number
  tone: ToastTone
  title: string
  description?: string
}

type ToastApi = {
  success: (title: string, description?: string) => void
  error: (title: string, description?: string) => void
  info: (title: string, description?: string) => void
}

const ToastContext = createContext<ToastApi | null>(null)

const icons = {
  success: <CircleCheck className="size-[18px] text-success-700" aria-hidden="true" />,
  error: <CircleAlert className="size-[18px] text-danger-600" aria-hidden="true" />,
  info: <Info className="size-[18px] text-info-700" aria-hidden="true" />,
}

export function ToastProvider({ children }: PropsWithChildren) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const nextId = useRef(1)

  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id))
  }, [])

  const push = useCallback(
    (tone: ToastTone, title: string, description?: string) => {
      const id = nextId.current++
      setToasts((current) => [...current.slice(-3), { id, tone, title, description }])
      window.setTimeout(() => dismiss(id), tone === 'error' ? 7000 : 4500)
    },
    [dismiss],
  )

  const api = useMemo<ToastApi>(
    () => ({
      success: (title, description) => push('success', title, description),
      error: (title, description) => push('error', title, description),
      info: (title, description) => push('info', title, description),
    }),
    [push],
  )

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div
        aria-live="polite"
        aria-relevant="additions"
        className="pointer-events-none fixed inset-x-4 bottom-4 z-[60] flex flex-col items-center gap-2 sm:inset-x-auto sm:right-5 sm:bottom-5 sm:items-end"
      >
        {toasts.map((toast) => (
          <div
            key={toast.id}
            role={toast.tone === 'error' ? 'alert' : 'status'}
            className={cn(
              'pointer-events-auto flex w-full max-w-sm animate-slide-up items-start gap-3 rounded-lg border bg-surface px-4 py-3 shadow-raised',
              toast.tone === 'error' ? 'border-danger-700/20' : 'border-line',
            )}
          >
            <span className="mt-px">{icons[toast.tone]}</span>
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-medium text-ink">{toast.title}</p>
              {toast.description && <p className="mt-0.5 text-[13px] text-muted">{toast.description}</p>}
            </div>
            <button
              type="button"
              onClick={() => dismiss(toast.id)}
              className="-mr-1 rounded p-0.5 text-subtle transition-colors hover:text-ink"
              aria-label="Dispensar notificação"
            >
              <X className="size-4" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const context = useContext(ToastContext)
  if (!context) throw new Error('useToast deve ser usado dentro de ToastProvider.')
  return context
}
