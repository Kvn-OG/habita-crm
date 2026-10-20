import { Inbox } from 'lucide-react'
import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

export function EmptyState({
  icon,
  title,
  description,
  action,
  compact = false,
  className,
}: {
  icon?: ReactNode
  title: string
  description?: ReactNode
  action?: ReactNode
  compact?: boolean
  className?: string
}) {
  return (
    <div className={cn('flex flex-col items-center text-center', compact ? 'px-4 py-8' : 'px-6 py-14', className)}>
      <div
        className={cn(
          'grid place-items-center rounded-full border border-line bg-canvas text-brand-700 [&_svg]:size-5',
          compact ? 'size-10' : 'size-12',
        )}
        aria-hidden="true"
      >
        {icon ?? <Inbox />}
      </div>
      <h3 className={cn('font-semibold text-ink', compact ? 'mt-3 text-[13px]' : 'mt-4 text-[15px]')}>{title}</h3>
      {description && (
        <p className={cn('max-w-sm text-muted', compact ? 'mt-1 text-xs leading-relaxed' : 'mt-1.5 text-[13px] leading-relaxed')}>
          {description}
        </p>
      )}
      {action && <div className={compact ? 'mt-3' : 'mt-5'}>{action}</div>}
    </div>
  )
}
