import { useQuery } from '@tanstack/react-query'
import { Check, LoaderCircle, Search, X } from 'lucide-react'
import { useId, useRef, useState, type ReactNode } from 'react'
import { useDebouncedValue } from '@/hooks/useDebouncedValue'
import { getErrorMessage } from '@/lib/errors'
import { cn } from '@/lib/utils'
import { inputBase } from './Field'

export type PickerOption = {
  id: string
  label: string
  description?: string
}

type AsyncPickerProps = {
  /** Chave de cache do TanStack Query para as buscas. */
  queryKey: string
  search: (term: string) => Promise<PickerOption[]>
  selected: PickerOption[]
  onChange: (selected: PickerOption[]) => void
  multiple?: boolean
  placeholder?: string
  emptyText?: string
  footer?: ReactNode
  id?: string
  disabled?: boolean
  'aria-invalid'?: true
  'aria-describedby'?: string
}

/** Combobox com busca no servidor, navegação por teclado e seleção única ou múltipla. */
export function AsyncPicker({
  queryKey,
  search,
  selected,
  onChange,
  multiple = false,
  placeholder = 'Digite para buscar',
  emptyText = 'Nenhum resultado encontrado.',
  footer,
  id,
  disabled,
  ...aria
}: AsyncPickerProps) {
  const [term, setTerm] = useState('')
  const [open, setOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)
  const debounced = useDebouncedValue(term.trim(), 250)
  const listId = useId()
  const containerRef = useRef<HTMLDivElement>(null)

  const query = useQuery({
    queryKey: ['picker', queryKey, debounced],
    queryFn: () => search(debounced),
    enabled: open,
    staleTime: 15_000,
  })

  const options = query.data ?? []
  const isSelected = (option: PickerOption) => selected.some((item) => item.id === option.id)

  const choose = (option: PickerOption) => {
    if (multiple) {
      onChange(isSelected(option) ? selected.filter((item) => item.id !== option.id) : [...selected, option])
      setTerm('')
    } else {
      onChange([option])
      setTerm('')
      setOpen(false)
    }
  }

  const remove = (option: PickerOption) => onChange(selected.filter((item) => item.id !== option.id))
  const single = !multiple ? selected[0] : undefined

  return (
    <div
      ref={containerRef}
      className="relative"
      onBlur={(event) => {
        if (!containerRef.current?.contains(event.relatedTarget as Node | null)) setOpen(false)
      }}
    >
      {single && !open ? (
        <div className={cn(inputBase, 'flex h-auto min-h-9.5 items-center justify-between gap-2 py-1.5')}>
          <button
            type="button"
            id={id}
            disabled={disabled}
            className="min-w-0 flex-1 text-left"
            onClick={() => setOpen(true)}
            aria-describedby={aria['aria-describedby']}
          >
            <span className="block truncate font-medium">{single.label}</span>
            {single.description && <span className="block truncate text-xs text-muted">{single.description}</span>}
          </button>
          {!disabled && (
            <button
              type="button"
              className="rounded p-1 text-subtle transition-colors hover:bg-hover hover:text-ink"
              onClick={() => onChange([])}
              aria-label={`Remover ${single.label}`}
            >
              <X className="size-4" />
            </button>
          )}
        </div>
      ) : (
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-subtle" aria-hidden="true" />
          <input
            id={id}
            type="text"
            role="combobox"
            aria-expanded={open}
            aria-controls={listId}
            aria-autocomplete="list"
            aria-activedescendant={open && options[activeIndex] ? `${listId}-${activeIndex}` : undefined}
            autoComplete="off"
            disabled={disabled}
            className={cn(inputBase, 'h-9.5 pl-9')}
            placeholder={placeholder}
            value={term}
            autoFocus={Boolean(single)}
            onFocus={() => setOpen(true)}
            onChange={(event) => {
              setTerm(event.target.value)
              setActiveIndex(0)
              setOpen(true)
            }}
            onKeyDown={(event) => {
              if (event.key === 'ArrowDown') {
                event.preventDefault()
                setOpen(true)
                setActiveIndex((index) => Math.min(index + 1, Math.max(options.length - 1, 0)))
              } else if (event.key === 'ArrowUp') {
                event.preventDefault()
                setActiveIndex((index) => Math.max(index - 1, 0))
              } else if (event.key === 'Enter' && open) {
                const option = options[activeIndex]
                if (option) {
                  event.preventDefault()
                  choose(option)
                }
              } else if (event.key === 'Escape' && open) {
                event.preventDefault()
                event.stopPropagation()
                setOpen(false)
              }
            }}
            {...aria}
          />
        </div>
      )}

      {open && (
        <div className="absolute inset-x-0 top-[calc(100%+4px)] z-30 animate-fade-in overflow-hidden rounded-lg border border-line bg-surface shadow-raised">
          <ul id={listId} role="listbox" aria-multiselectable={multiple || undefined} className="max-h-64 overflow-y-auto p-1">
            {query.isLoading && (
              <li className="flex items-center gap-2 px-3 py-2.5 text-[13px] text-muted">
                <LoaderCircle className="size-4 animate-spin" aria-hidden="true" /> Buscando…
              </li>
            )}
            {query.isError && <li className="px-3 py-2.5 text-[13px] text-danger-700">{getErrorMessage(query.error)}</li>}
            {!query.isLoading && !query.isError && options.length === 0 && (
              <li className="px-3 py-2.5 text-[13px] text-muted">{emptyText}</li>
            )}
            {options.map((option, index) => {
              const checked = isSelected(option)
              return (
                <li
                  key={option.id}
                  id={`${listId}-${index}`}
                  role="option"
                  aria-selected={checked}
                  tabIndex={-1}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => choose(option)}
                  onMouseEnter={() => setActiveIndex(index)}
                  className={cn(
                    'flex cursor-pointer items-center gap-2.5 rounded-md px-3 py-2 text-[13px]',
                    index === activeIndex && 'bg-hover',
                  )}
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium text-ink">{option.label}</span>
                    {option.description && <span className="block truncate text-xs text-muted">{option.description}</span>}
                  </span>
                  {checked && <Check className="size-4 shrink-0 text-brand-700" aria-hidden="true" />}
                </li>
              )
            })}
          </ul>
          {footer && <div className="border-t border-line bg-canvas/60 px-3 py-2 text-xs">{footer}</div>}
        </div>
      )}

      {multiple && selected.length > 0 && (
        <ul className="mt-2 flex flex-wrap gap-1.5" aria-label="Itens selecionados">
          {selected.map((option) => (
            <li
              key={option.id}
              className="inline-flex max-w-full items-center gap-1 rounded-md border border-brand-200 bg-brand-50 py-1 pr-1 pl-2.5 text-xs font-medium text-brand-800"
            >
              <span className="truncate">{option.label}</span>
              {!disabled && (
                <button
                  type="button"
                  onClick={() => remove(option)}
                  className="rounded p-0.5 text-brand-700 transition-colors hover:bg-brand-100"
                  aria-label={`Remover ${option.label}`}
                >
                  <X className="size-3.5" />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
