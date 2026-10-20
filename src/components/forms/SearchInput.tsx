import { Search, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { inputBase } from './Field'

export function SearchInput({
  value,
  onChange,
  placeholder,
  label,
  className,
}: {
  value: string
  onChange: (value: string) => void
  placeholder: string
  label: string
  className?: string
}) {
  return (
    <div className={cn('relative', className)}>
      <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-subtle" aria-hidden="true" />
      <input
        type="search"
        aria-label={label}
        placeholder={placeholder}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={cn(inputBase, 'h-9.5 pr-9 pl-9 [&::-webkit-search-cancel-button]:hidden')}
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange('')}
          className="absolute top-1/2 right-2 -translate-y-1/2 rounded p-1 text-subtle transition-colors hover:text-ink"
          aria-label="Limpar busca"
        >
          <X className="size-4" />
        </button>
      )}
    </div>
  )
}

/** Select compacto para barras de filtro. */
export function FilterSelect({
  value,
  onChange,
  label,
  options,
  allLabel,
}: {
  value: string
  onChange: (value: string) => void
  label: string
  options: { value: string; label: string }[]
  allLabel: string
}) {
  return (
    <select
      aria-label={label}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className={cn(
        inputBase,
        'h-9.5 w-full appearance-none bg-[length:16px] bg-[right_10px_center] bg-no-repeat pr-8 sm:w-auto',
        "bg-[url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23959d98' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")]",
        value && 'border-brand-700/40 bg-brand-50/50 text-brand-900',
      )}
    >
      <option value="">{allLabel}</option>
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  )
}
