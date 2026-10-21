import { CornerDownLeft, Search } from 'lucide-react'
import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/auth/AuthContext'
import { commandGroupLabels, commandsByIds, DEFAULT_QUICK_ACTIONS, searchCommands, type Command } from '@/app/commands'
import { cn } from '@/lib/utils'

type Item = { kind: 'command'; command: Command } | { kind: 'search'; term: string }

/**
 * Pesquisa do cabeçalho: sugere ações e páginas do CRM conforme o texto digitado
 * e oferece buscar o termo em imóveis, contatos e leads. Atalho: Ctrl+K.
 */
export function GlobalSearch() {
  const navigate = useNavigate()
  const [value, setValue] = useState('')
  const [open, setOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const listId = useId()

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        inputRef.current?.focus()
        setOpen(true)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  const term = value.trim()
  const isManager = useAuth().permissions.canViewReports
  const items = useMemo<Item[]>(() => {
    const matches = term ? searchCommands(term, 7, isManager) : commandsByIds(DEFAULT_QUICK_ACTIONS)
    const list: Item[] = matches.map((command) => ({ kind: 'command', command }))
    if (term.length >= 2) list.push({ kind: 'search', term })
    return list
  }, [term, isManager])

  const close = () => {
    setOpen(false)
    setActiveIndex(0)
  }

  const choose = (item: Item) => {
    if (item.kind === 'command') navigate(item.command.to)
    else navigate(`/busca?q=${encodeURIComponent(item.term)}`)
    setValue('')
    close()
    inputRef.current?.blur()
  }

  // Rótulo de seção de cada item; o cabeçalho aparece quando a seção muda.
  const groups = items.map((item) =>
    item.kind === 'command' ? (term ? commandGroupLabels[item.command.group] : 'Ações rápidas') : 'Pesquisar no CRM',
  )

  return (
    <div
      ref={containerRef}
      className="relative hidden w-full max-w-sm md:block"
      onBlur={(event) => {
        if (!containerRef.current?.contains(event.relatedTarget as Node | null)) close()
      }}
    >
      <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-subtle" aria-hidden="true" />
      <input
        ref={inputRef}
        type="search"
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={open && items[activeIndex] ? `${listId}-${activeIndex}` : undefined}
        aria-label="Pesquisar ações, páginas, imóveis, contatos e leads"
        placeholder="Pesquisar ou ir para…"
        autoComplete="off"
        value={value}
        onFocus={() => setOpen(true)}
        onChange={(event) => {
          setValue(event.target.value)
          setActiveIndex(0)
          setOpen(true)
        }}
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown') {
            event.preventDefault()
            setOpen(true)
            setActiveIndex((index) => Math.min(index + 1, items.length - 1))
          } else if (event.key === 'ArrowUp') {
            event.preventDefault()
            setActiveIndex((index) => Math.max(index - 1, 0))
          } else if (event.key === 'Enter') {
            const item = items[activeIndex]
            if (item) {
              event.preventDefault()
              choose(item)
            }
          } else if (event.key === 'Escape') {
            close()
            inputRef.current?.blur()
          }
        }}
        className="h-9 w-full rounded-md border border-line bg-canvas pr-14 pl-9 text-[13px] text-ink placeholder:text-subtle transition-colors hover:border-line-strong focus:border-brand-700 focus:bg-surface focus:ring-3 focus:ring-brand-700/12 focus:outline-none [&::-webkit-search-cancel-button]:hidden"
      />
      <kbd className="pointer-events-none absolute top-1/2 right-2.5 hidden -translate-y-1/2 rounded border border-line bg-surface px-1.5 py-px font-sans text-[10px] font-medium text-subtle lg:block">
        Ctrl K
      </kbd>

      {open && (
        <div className="absolute inset-x-0 top-[calc(100%+6px)] z-40 animate-fade-in overflow-hidden rounded-lg border border-line bg-surface shadow-raised">
          <ul id={listId} role="listbox" aria-label="Sugestões" className="max-h-[min(26rem,70dvh)] overflow-y-auto p-1.5">
            {items.length === 0 && (
              <li className="px-3 py-3 text-[13px] text-muted">Digite pelo menos 2 letras para pesquisar.</li>
            )}
            {items.map((item, index) => {
              const header = groups[index] !== groups[index - 1] ? groups[index] : null
              const active = index === activeIndex
              return (
                <li key={item.kind === 'command' ? item.command.id : 'search'} role="presentation">
                  {header && <p className="px-2.5 pt-2 pb-1 text-[11px] font-semibold tracking-wide text-subtle uppercase">{header}</p>}
                  <div
                    id={`${listId}-${index}`}
                    role="option"
                    aria-selected={active}
                    onMouseDown={(event) => event.preventDefault()}
                    onMouseEnter={() => setActiveIndex(index)}
                    onClick={() => choose(item)}
                    className={cn('flex cursor-pointer items-center gap-3 rounded-md px-2.5 py-2', active && 'bg-hover')}
                  >
                    {item.kind === 'command' ? (
                      <>
                        <span className="grid size-7 shrink-0 place-items-center rounded-md bg-brand-50 text-brand-800 [&_svg]:size-4" aria-hidden="true">
                          <item.command.icon />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[13px] font-medium text-ink">{item.command.label}</span>
                          <span className="block truncate text-xs text-muted">{item.command.description}</span>
                        </span>
                      </>
                    ) : (
                      <>
                        <span className="grid size-7 shrink-0 place-items-center rounded-md bg-accent-50 text-accent-700 [&_svg]:size-4" aria-hidden="true">
                          <Search />
                        </span>
                        <span className="min-w-0 flex-1 truncate text-[13px] text-ink">
                          Buscar “<strong className="font-semibold">{item.term}</strong>” em imóveis, contatos e leads
                        </span>
                      </>
                    )}
                    {active && <CornerDownLeft className="size-3.5 shrink-0 text-subtle" aria-hidden="true" />}
                  </div>
                </li>
              )
            })}
          </ul>
          <p className="border-t border-line bg-canvas/60 px-3 py-1.5 text-[11px] text-subtle">↑ ↓ para navegar · Enter para abrir · Esc para fechar</p>
        </div>
      )}
    </div>
  )
}
