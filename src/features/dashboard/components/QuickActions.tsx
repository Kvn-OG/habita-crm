import { ArrowDown, ArrowRight, ArrowUp, RotateCcw, SlidersHorizontal } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { commands, commandsByIds, DEFAULT_QUICK_ACTIONS, MAX_QUICK_ACTIONS } from '@/app/commands'
import { useAuth } from '@/auth/AuthContext'
import { EmptyState } from '@/components/feedback/EmptyState'
import { useToast } from '@/components/feedback/Toast'
import { Button, IconButton } from '@/components/ui/Button'
import { Card, CardHeader } from '@/components/ui/Card'
import { Modal } from '@/components/ui/Modal'
import { updateOwnPreferences } from '@/features/settings/api'
import { getErrorMessage } from '@/lib/errors'
import { cn } from '@/lib/utils'

const available = commands.filter((command) => command.quick)

/** Ações rápidas do painel, escolhidas e ordenadas por cada usuário (salvas no perfil). */
export function QuickActions({ className }: { className?: string }) {
  const { profile } = useAuth()
  const [customizing, setCustomizing] = useState(false)
  const saved = profile?.preferences?.quick_actions
  const selectedIds = Array.isArray(saved) ? saved : DEFAULT_QUICK_ACTIONS
  const actions = commandsByIds(selectedIds)

  return (
    <Card className={cn('flex flex-col', className)}>
      <CardHeader
        title="Ações rápidas"
        actions={
          <Button variant="ghost" size="sm" icon={<SlidersHorizontal />} onClick={() => setCustomizing(true)}>
            Personalizar
          </Button>
        }
      />
      {actions.length ? (
        <ul className="grid gap-2 p-4 sm:grid-cols-2 xl:grid-cols-1">
          {actions.map(({ id, to, label, icon: Icon }) => (
            <li key={id}>
              <Link
                to={to}
                className="group flex items-center gap-3 rounded-md border border-line px-3.5 py-3 text-[13px] font-medium text-ink transition-colors hover:border-brand-700/30 hover:bg-brand-50/60"
              >
                <span className="grid size-8 place-items-center rounded-md bg-brand-900 text-mint [&_svg]:size-4" aria-hidden="true">
                  <Icon />
                </span>
                <span className="flex-1">{label}</span>
                <ArrowRight className="size-4 text-subtle transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState
          compact
          icon={<SlidersHorizontal />}
          title="Nenhuma ação escolhida"
          description="Escolha os atalhos que você mais usa."
          action={
            <Button size="sm" variant="secondary" onClick={() => setCustomizing(true)}>
              Escolher ações
            </Button>
          }
        />
      )}
      <QuickActionsCustomizer open={customizing} onClose={() => setCustomizing(false)} initial={actions.map((action) => action.id)} />
    </Card>
  )
}

function QuickActionsCustomizer({ open, onClose, initial }: { open: boolean; onClose: () => void; initial: string[] }) {
  if (!open) return null
  return <CustomizerContent onClose={onClose} initial={initial} />
}

function CustomizerContent({ onClose, initial }: { onClose: () => void; initial: string[] }) {
  const { profile, refreshProfile } = useAuth()
  const toast = useToast()
  const [selected, setSelected] = useState<string[]>(initial)
  const [saving, setSaving] = useState(false)
  const limitReached = selected.length >= MAX_QUICK_ACTIONS

  const toggle = (id: string) =>
    setSelected((current) => (current.includes(id) ? current.filter((item) => item !== id) : limitReached ? current : [...current, id]))

  const move = (index: number, direction: -1 | 1) =>
    setSelected((current) => {
      const next = [...current]
      const target = index + direction
      if (target < 0 || target >= next.length) return current
      ;[next[index], next[target]] = [next[target] as string, next[index] as string]
      return next
    })

  const save = async () => {
    if (!profile) return
    setSaving(true)
    try {
      await updateOwnPreferences(profile.id, profile.preferences, { quick_actions: selected })
      await refreshProfile()
      toast.success('Ações rápidas atualizadas.')
      onClose()
    } catch (error) {
      toast.error('Não foi possível salvar', getErrorMessage(error))
    } finally {
      setSaving(false)
    }
  }

  const selectedCommands = commandsByIds(selected)

  return (
    <Modal
      open
      onClose={onClose}
      dismissible={!saving}
      title="Personalizar ações rápidas"
      description={`Escolha até ${MAX_QUICK_ACTIONS} atalhos e a ordem em que aparecem. A escolha vale só para você.`}
      footer={
        <>
          <Button variant="ghost" icon={<RotateCcw />} onClick={() => setSelected(DEFAULT_QUICK_ACTIONS)} disabled={saving} className="sm:mr-auto">
            Restaurar padrão
          </Button>
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={() => void save()} loading={saving}>
            Salvar
          </Button>
        </>
      }
    >
      <div className="grid gap-6 sm:grid-cols-2">
        <section>
          <h3 className="text-xs font-semibold tracking-wide text-subtle uppercase">Disponíveis</h3>
          <ul className="mt-2 space-y-1">
            {available.map((command) => {
              const checked = selected.includes(command.id)
              const disabled = !checked && limitReached
              return (
                <li key={command.id}>
                  <label
                    className={cn(
                      'flex cursor-pointer items-center gap-3 rounded-md px-2.5 py-2 transition-colors hover:bg-hover',
                      disabled && 'cursor-not-allowed opacity-50',
                    )}
                  >
                    <input
                      type="checkbox"
                      className="size-4 shrink-0 cursor-pointer accent-brand-800"
                      checked={checked}
                      disabled={disabled}
                      onChange={() => toggle(command.id)}
                    />
                    <command.icon className="size-4 shrink-0 text-brand-700" aria-hidden="true" />
                    <span className="min-w-0">
                      <span className="block truncate text-[13px] font-medium text-ink">{command.label}</span>
                      <span className="block truncate text-xs text-muted">{command.description}</span>
                    </span>
                  </label>
                </li>
              )
            })}
          </ul>
        </section>
        <section>
          <h3 className="text-xs font-semibold tracking-wide text-subtle uppercase">
            No painel ({selected.length}/{MAX_QUICK_ACTIONS})
          </h3>
          {selectedCommands.length ? (
            <ol className="mt-2 space-y-1.5">
              {selectedCommands.map((command, index) => (
                <li key={command.id} className="flex items-center gap-2 rounded-md border border-line bg-canvas/60 py-1.5 pr-1 pl-3">
                  <span className="w-4 text-xs font-semibold text-subtle tabular">{index + 1}</span>
                  <span className="min-w-0 flex-1 truncate text-[13px] text-ink">{command.label}</span>
                  <IconButton label={`Mover ${command.label} para cima`} onClick={() => move(index, -1)} disabled={index === 0}>
                    <ArrowUp />
                  </IconButton>
                  <IconButton label={`Mover ${command.label} para baixo`} onClick={() => move(index, 1)} disabled={index === selectedCommands.length - 1}>
                    <ArrowDown />
                  </IconButton>
                </li>
              ))}
            </ol>
          ) : (
            <p className="mt-2 rounded-md border border-dashed border-line-strong px-3 py-6 text-center text-xs text-muted">
              Nenhuma ação selecionada.
            </p>
          )}
        </section>
      </div>
    </Modal>
  )
}
