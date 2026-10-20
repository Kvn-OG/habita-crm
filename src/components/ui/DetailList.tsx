import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

/** Lista de pares rótulo/valor para telas de detalhes. */
export function DetailList({ children, columns = 2, className }: { children: ReactNode; columns?: 1 | 2 | 3; className?: string }) {
  return (
    <dl
      className={cn(
        'grid gap-x-6 gap-y-4',
        columns === 2 && 'sm:grid-cols-2',
        columns === 3 && 'sm:grid-cols-2 lg:grid-cols-3',
        className,
      )}
    >
      {children}
    </dl>
  )
}

export function DetailItem({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  const empty = children === null || children === undefined || children === '' || children === '—'
  return (
    <div className={cn('min-w-0', className)}>
      <dt className="text-xs text-muted">{label}</dt>
      <dd className={cn('mt-0.5 text-[13px] break-words', empty ? 'text-subtle' : 'font-medium text-ink')}>{empty ? '—' : children}</dd>
    </div>
  )
}
