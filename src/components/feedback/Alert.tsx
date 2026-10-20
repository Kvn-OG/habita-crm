import { CircleAlert, CircleCheck, Info, TriangleAlert } from 'lucide-react'
import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

type AlertTone = 'info' | 'success' | 'warning' | 'danger'

const styles: Record<AlertTone, { box: string; icon: ReactNode }> = {
  info: { box: 'border-info-700/15 bg-info-50 text-info-700', icon: <Info aria-hidden="true" /> },
  success: { box: 'border-success-700/15 bg-success-50 text-success-700', icon: <CircleCheck aria-hidden="true" /> },
  warning: { box: 'border-warning-700/20 bg-warning-50 text-warning-700', icon: <TriangleAlert aria-hidden="true" /> },
  danger: { box: 'border-danger-700/15 bg-danger-50 text-danger-700', icon: <CircleAlert aria-hidden="true" /> },
}

export function Alert({
  tone = 'info',
  title,
  children,
  action,
  className,
}: {
  tone?: AlertTone
  title?: ReactNode
  children?: ReactNode
  action?: ReactNode
  className?: string
}) {
  return (
    <div
      role={tone === 'danger' ? 'alert' : 'status'}
      className={cn('flex gap-3 rounded-lg border px-4 py-3 text-[13px] [&>svg]:mt-px [&>svg]:size-[18px] [&>svg]:shrink-0', styles[tone].box, className)}
    >
      {styles[tone].icon}
      <div className="min-w-0 flex-1 leading-relaxed">
        {title && <p className="font-semibold">{title}</p>}
        {children && <div className={cn(title ? 'mt-0.5' : undefined, 'text-ink/80')}>{children}</div>}
        {action && <div className="mt-2.5">{action}</div>}
      </div>
    </div>
  )
}
