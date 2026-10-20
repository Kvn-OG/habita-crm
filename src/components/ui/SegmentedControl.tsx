import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

type Option<T extends string> = { value: T; label: string; icon?: ReactNode }

export function SegmentedControl<T extends string>({
  value,
  onChange,
  options,
  label,
  className,
}: {
  value: T
  onChange: (value: T) => void
  options: Option<T>[]
  label: string
  className?: string
}) {
  return (
    <div role="radiogroup" aria-label={label} className={cn('inline-flex rounded-md border border-line bg-canvas p-0.5', className)}>
      {options.map((option) => {
        const active = option.value === value
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(option.value)}
            className={cn(
              'inline-flex h-8 items-center gap-1.5 rounded-[5px] px-3 text-[13px] font-medium transition-colors [&_svg]:size-4',
              active ? 'bg-surface text-brand-900 shadow-card' : 'text-muted hover:text-ink',
            )}
          >
            {option.icon}
            {option.label}
          </button>
        )
      })}
    </div>
  )
}
