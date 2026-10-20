import { useEffect, useId, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { cn } from '@/lib/utils'

type PopoverProps = {
  trigger: (props: { open: boolean; toggle: () => void; id: string }) => ReactNode
  children: (close: () => void) => ReactNode
  align?: 'start' | 'end'
  className?: string
}

/**
 * Painel suspenso com posicionamento fixo (não é cortado por contêineres com rolagem).
 * Fecha ao clicar fora, pressionar Esc, rolar a página ou redimensionar a janela.
 */
export function Popover({ trigger, children, align = 'end', className }: PopoverProps) {
  const [open, setOpen] = useState(false)
  const [style, setStyle] = useState<CSSProperties>({})
  const anchorRef = useRef<HTMLDivElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const id = useId()

  useLayoutEffect(() => {
    if (!open || !anchorRef.current) return
    const rect = anchorRef.current.getBoundingClientRect()
    const gutter = 8
    const next: CSSProperties = { position: 'fixed', top: rect.bottom + 6 }
    if (align === 'end') next.right = Math.max(gutter, window.innerWidth - rect.right)
    else next.left = Math.max(gutter, rect.left)
    setStyle(next)
  }, [open, align])

  useEffect(() => {
    if (!open) return
    const close = () => setOpen(false)
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node
      if (!anchorRef.current?.contains(target) && !panelRef.current?.contains(target)) close()
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation()
        close()
      }
    }
    const onScroll = (event: Event) => {
      if (!panelRef.current?.contains(event.target as Node)) close()
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    window.addEventListener('scroll', onScroll, true)
    window.addEventListener('resize', close)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('scroll', onScroll, true)
      window.removeEventListener('resize', close)
    }
  }, [open])

  return (
    <div ref={anchorRef} className="relative">
      {trigger({ open, toggle: () => setOpen((value) => !value), id })}
      {open && (
        <div
          ref={panelRef}
          id={id}
          style={style}
          className={cn(
            'z-50 max-h-[min(24rem,calc(100dvh-6rem))] max-w-[calc(100vw-1rem)] min-w-56 animate-fade-in overflow-y-auto rounded-lg border border-line bg-surface p-1.5 shadow-raised',
            className,
          )}
        >
          {children(() => setOpen(false))}
        </div>
      )}
    </div>
  )
}

export function MenuItem({
  icon,
  children,
  onClick,
  tone = 'default',
}: {
  icon?: ReactNode
  children: ReactNode
  onClick: () => void
  tone?: 'default' | 'danger'
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-[13px] transition-colors [&_svg]:size-4',
        tone === 'danger' ? 'text-danger-700 hover:bg-danger-50' : 'text-ink hover:bg-hover',
      )}
    >
      {icon}
      {children}
    </button>
  )
}
