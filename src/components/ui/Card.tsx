import type { HTMLAttributes, ReactNode } from 'react'
import { cn } from '@/lib/utils'

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('rounded-lg border border-line bg-surface shadow-card', className)} {...props} />
}

export function CardHeader({
  title,
  description,
  actions,
  className,
  as: Heading = 'h2',
}: {
  title: ReactNode
  description?: ReactNode
  actions?: ReactNode
  className?: string
  as?: 'h2' | 'h3'
}) {
  return (
    <div className={cn('flex flex-wrap items-start justify-between gap-3 border-b border-line px-5 py-4 sm:flex-nowrap', className)}>
      <div className="min-w-0 flex-1">
        <Heading className="text-[15px] font-semibold text-ink">{title}</Heading>
        {description && <p className="mt-0.5 text-[13px] text-muted">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  )
}

export function CardBody({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('p-5', className)} {...props} />
}
