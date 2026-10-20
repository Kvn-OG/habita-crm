import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

export type BadgeTone = 'neutral' | 'brand' | 'accent' | 'success' | 'warning' | 'danger' | 'info'

const tones: Record<BadgeTone, { badge: string; dot: string }> = {
  neutral: { badge: 'bg-hover text-muted ring-line', dot: 'bg-subtle' },
  brand: { badge: 'bg-brand-50 text-brand-800 ring-brand-200', dot: 'bg-brand-700' },
  accent: { badge: 'bg-accent-50 text-accent-700 ring-accent-200', dot: 'bg-accent-500' },
  success: { badge: 'bg-success-50 text-success-700 ring-success-700/15', dot: 'bg-success-700' },
  warning: { badge: 'bg-warning-50 text-warning-700 ring-warning-700/15', dot: 'bg-warning-700' },
  danger: { badge: 'bg-danger-50 text-danger-700 ring-danger-700/15', dot: 'bg-danger-600' },
  info: { badge: 'bg-info-50 text-info-700 ring-info-700/15', dot: 'bg-info-700' },
}

export function Badge({
  tone = 'neutral',
  dot = false,
  className,
  children,
}: {
  tone?: BadgeTone
  dot?: boolean
  className?: string
  children: ReactNode
}) {
  return (
    <span
      className={cn(
        'inline-flex max-w-full items-center gap-1.5 truncate rounded-sm px-2 py-0.5 text-xs font-medium ring-1 ring-inset',
        tones[tone].badge,
        className,
      )}
    >
      {dot && <span className={cn('size-1.5 shrink-0 rounded-full', tones[tone].dot)} aria-hidden="true" />}
      {children}
    </span>
  )
}
