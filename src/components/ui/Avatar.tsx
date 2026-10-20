import { cn, initials } from '@/lib/utils'

const sizes = {
  xs: 'size-6 text-[10px]',
  sm: 'size-8 text-xs',
  md: 'size-9 text-[13px]',
  lg: 'size-12 text-base',
}

export function Avatar({
  name,
  size = 'md',
  tone = 'soft',
  className,
}: {
  name: string
  size?: keyof typeof sizes
  tone?: 'soft' | 'brand' | 'accent'
  className?: string
}) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'inline-grid shrink-0 place-items-center rounded-full font-semibold tracking-wide select-none',
        tone === 'soft' && 'bg-brand-100 text-brand-800',
        tone === 'brand' && 'bg-brand-800 text-white',
        tone === 'accent' && 'bg-mint text-brand-900',
        sizes[size],
        className,
      )}
    >
      {initials(name)}
    </span>
  )
}
