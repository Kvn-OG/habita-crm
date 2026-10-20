import { X } from 'lucide-react'
import { useEffect, useId, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { cn } from '@/lib/utils'
import { IconButton } from './Button'

type ModalSize = 'sm' | 'md' | 'lg' | 'xl'

const sizes: Record<ModalSize, string> = {
  sm: 'max-w-md',
  md: 'max-w-xl',
  lg: 'max-w-3xl',
  xl: 'max-w-5xl',
}

type ModalProps = {
  open: boolean
  onClose: () => void
  title: ReactNode
  description?: ReactNode
  children: ReactNode
  footer?: ReactNode
  size?: ModalSize
  /** Impede fechar (Esc/clique fora) durante operações em andamento. */
  dismissible?: boolean
}

/**
 * Modal acessível baseado no elemento <dialog> nativo:
 * foco preso no conteúdo, Esc para fechar e fundo inerte.
 * Renderizado em portal para permitir modais sobrepostos sem aninhar formulários.
 */
export function Modal(props: ModalProps) {
  if (!props.open) return null
  return createPortal(<ModalContent {...props} />, document.body)
}

function ModalContent({ onClose, title, description, children, footer, size = 'md', dismissible = true }: ModalProps) {
  const ref = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  const descriptionId = useId()

  useEffect(() => {
    const dialog = ref.current
    const previouslyFocused = document.activeElement as HTMLElement | null
    if (dialog && !dialog.open) dialog.showModal()
    const root = document.documentElement
    const openCount = Number(root.dataset.openModals ?? 0) + 1
    root.dataset.openModals = String(openCount)
    root.style.overflow = 'hidden'
    return () => {
      const remaining = Number(root.dataset.openModals ?? 1) - 1
      root.dataset.openModals = String(remaining)
      if (remaining <= 0) root.style.overflow = ''
      previouslyFocused?.focus?.()
    }
  }, [])

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      aria-describedby={description ? descriptionId : undefined}
      className={cn(
        'm-auto max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] overflow-hidden rounded-xl border border-line bg-surface p-0 text-ink shadow-overlay',
        'open:flex open:animate-slide-up open:flex-col',
        sizes[size],
      )}
      onCancel={(event) => {
        event.preventDefault()
        if (dismissible) onClose()
      }}
      onMouseDown={(event) => {
        if (dismissible && event.target === event.currentTarget) onClose()
      }}
    >
      <header className="flex items-start justify-between gap-4 border-b border-line px-5 py-4 sm:px-6">
        <div className="min-w-0">
          <h2 id={titleId} className="text-base font-semibold text-ink">
            {title}
          </h2>
          {description && (
            <p id={descriptionId} className="mt-1 text-[13px] text-muted">
              {description}
            </p>
          )}
        </div>
        <IconButton label="Fechar" onClick={onClose} disabled={!dismissible} className="-mr-2 -mt-1">
          <X />
        </IconButton>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6">{children}</div>
      {footer && (
        <footer className="flex flex-col-reverse gap-2 border-t border-line bg-canvas/60 px-5 py-3.5 sm:flex-row sm:justify-end sm:px-6">
          {footer}
        </footer>
      )}
    </dialog>
  )
}
