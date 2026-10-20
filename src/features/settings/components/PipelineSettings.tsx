import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowDown, ArrowUp, Check, Info, Pencil, Plus, X } from 'lucide-react'
import { useState } from 'react'
import { useAuth } from '@/auth/AuthContext'
import { ErrorState } from '@/components/feedback/ErrorState'
import { useToast } from '@/components/feedback/Toast'
import { Input, Select } from '@/components/forms/inputs'
import { Badge } from '@/components/ui/Badge'
import { Button, IconButton } from '@/components/ui/Button'
import { Card, CardHeader } from '@/components/ui/Card'
import { TableSkeleton } from '@/components/ui/Feedback'
import { SegmentedControl } from '@/components/ui/SegmentedControl'
import { leadKeys, stagesKey, useStages } from '@/features/leads/api'
import { LeadStageBadge } from '@/features/leads/components/LeadBadges'
import { getErrorMessage } from '@/lib/errors'
import { pipelineLabels, stageCategoryLabels, toOptions } from '@/lib/labels'
import { cn } from '@/lib/utils'
import type { Pipeline, PipelineStage, StageCategory } from '@/types/domain'
import { countLeadsInStage, createStage, reorderStages, updateStage } from '../api'

export function PipelineSettings() {
  const { permissions } = useAuth()
  const queryClient = useQueryClient()
  const toast = useToast()
  const stagesQuery = useStages()
  const [pipeline, setPipeline] = useState<Pipeline>('venda')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draftName, setDraftName] = useState('')
  const [newName, setNewName] = useState('')
  const [newCategory, setNewCategory] = useState<StageCategory>('aberto')
  const canEdit = permissions.canManageSettings

  const stages = (stagesQuery.data ?? []).filter((stage) => stage.pipeline === pipeline)

  const refresh = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: stagesKey }),
      queryClient.invalidateQueries({ queryKey: leadKeys.all }),
      queryClient.invalidateQueries({ queryKey: ['dashboard'] }),
    ])

  const mutation = useMutation({
    mutationFn: async (action: () => Promise<void>) => action(),
    onSuccess: async () => {
      await refresh()
      toast.success('Funil atualizado.')
    },
    onError: (error) => toast.error('Não foi possível atualizar o funil', getErrorMessage(error)),
  })

  const move = (index: number, direction: -1 | 1) => {
    const ids = stages.map((stage) => stage.id)
    const target = index + direction
    if (target < 0 || target >= ids.length) return
    ;[ids[index], ids[target]] = [ids[target] as string, ids[index] as string]
    mutation.mutate(() => reorderStages(pipeline, ids))
  }

  const toggleActive = (stage: PipelineStage) =>
    mutation.mutate(async () => {
      if (stage.is_active) {
        const count = await countLeadsInStage(stage.id)
        if (count > 0) throw new Error(`Há ${count} lead(s) nesta etapa. Mova-os antes de desativá-la.`)
      }
      await updateStage(stage.id, { is_active: !stage.is_active })
    })

  const saveName = (stage: PipelineStage) => {
    const name = draftName.trim()
    if (name.length < 2) {
      toast.error('Informe um nome com pelo menos 2 caracteres.')
      return
    }
    mutation.mutate(async () => {
      await updateStage(stage.id, { name })
      setEditingId(null)
    })
  }

  const addStage = () => {
    const name = newName.trim()
    if (name.length < 2) {
      toast.error('Informe o nome da nova etapa.')
      return
    }
    const position = Math.max(0, ...stages.map((stage) => stage.position)) + 1
    mutation.mutate(async () => {
      await createStage(pipeline, name, newCategory, position)
      setNewName('')
      setNewCategory('aberto')
    })
  }

  return (
    <div className="space-y-5">
      <p className="flex items-start gap-2 text-xs leading-relaxed text-muted">
        <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
        As etapas ficam armazenadas no banco de dados. A categoria define como cada etapa entra nos indicadores do painel (em aberto, em negociação, concluído ou perdido).
        {!canEdit && ' Somente administradores podem alterar os funis.'}
      </p>

      <Card>
        <CardHeader
          title={`Funil de ${pipelineLabels[pipeline].toLowerCase()}`}
          actions={
            <SegmentedControl
              label="Funil"
              value={pipeline}
              onChange={(value) => {
                setPipeline(value)
                setEditingId(null)
              }}
              options={[
                { value: 'venda', label: 'Venda' },
                { value: 'locacao', label: 'Locação' },
              ]}
            />
          }
        />
        {stagesQuery.isLoading ? (
          <TableSkeleton rows={5} />
        ) : stagesQuery.isError ? (
          <ErrorState error={stagesQuery.error} onRetry={() => void stagesQuery.refetch()} />
        ) : (
          <ol className="divide-y divide-line">
            {stages.map((stage, index) => (
              <li key={stage.id} className={cn('flex flex-col gap-3 px-5 py-3 sm:flex-row sm:items-center', !stage.is_active && 'bg-canvas/70')}>
                <span className="w-6 text-xs font-semibold text-subtle tabular">{index + 1}</span>
                <div className="min-w-0 flex-1">
                  {editingId === stage.id ? (
                    <form
                      className="flex gap-2"
                      onSubmit={(event) => {
                        event.preventDefault()
                        saveName(stage)
                      }}
                    >
                      <Input aria-label="Nome da etapa" value={draftName} maxLength={60} autoFocus onChange={(event) => setDraftName(event.target.value)} className="h-8" />
                      <IconButton label="Salvar nome" type="submit" loading={mutation.isPending}>
                        <Check />
                      </IconButton>
                      <IconButton label="Cancelar edição" onClick={() => setEditingId(null)}>
                        <X />
                      </IconButton>
                    </form>
                  ) : (
                    <div className="flex flex-wrap items-center gap-2">
                      <LeadStageBadge name={stage.name} category={stage.category} />
                      {!stage.is_active && <Badge tone="neutral">Desativada</Badge>}
                    </div>
                  )}
                </div>
                {canEdit ? (
                  <div className="flex flex-wrap items-center gap-1.5">
                    <div className="w-44">
                      <Select
                        aria-label={`Categoria de ${stage.name}`}
                        className="h-8 text-[13px]"
                        value={stage.category}
                        disabled={mutation.isPending}
                        onChange={(event) => mutation.mutate(() => updateStage(stage.id, { category: event.target.value as StageCategory }))}
                      >
                        {toOptions(stageCategoryLabels).map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </Select>
                    </div>
                    <IconButton
                      label="Renomear etapa"
                      onClick={() => {
                        setEditingId(stage.id)
                        setDraftName(stage.name)
                      }}
                    >
                      <Pencil />
                    </IconButton>
                    <IconButton label="Mover para cima" onClick={() => move(index, -1)} disabled={index === 0 || mutation.isPending}>
                      <ArrowUp />
                    </IconButton>
                    <IconButton label="Mover para baixo" onClick={() => move(index, 1)} disabled={index === stages.length - 1 || mutation.isPending}>
                      <ArrowDown />
                    </IconButton>
                    <Button size="sm" variant="ghost" onClick={() => toggleActive(stage)} disabled={mutation.isPending}>
                      {stage.is_active ? 'Desativar' : 'Reativar'}
                    </Button>
                  </div>
                ) : (
                  <span className="text-xs text-muted">{stageCategoryLabels[stage.category]}</span>
                )}
              </li>
            ))}
          </ol>
        )}
        {canEdit && (
          <form
            className="flex flex-col gap-2 border-t border-line bg-canvas/50 px-5 py-4 sm:flex-row sm:items-center"
            onSubmit={(event) => {
              event.preventDefault()
              addStage()
            }}
          >
            <Input aria-label="Nome da nova etapa" placeholder="Nome da nova etapa" maxLength={60} value={newName} onChange={(event) => setNewName(event.target.value)} className="sm:max-w-xs" />
            <div className="sm:w-48">
              <Select aria-label="Categoria da nova etapa" value={newCategory} onChange={(event) => setNewCategory(event.target.value as StageCategory)}>
                {toOptions(stageCategoryLabels).map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
            </div>
            <Button type="submit" variant="secondary" icon={<Plus />} loading={mutation.isPending}>
              Adicionar etapa
            </Button>
          </form>
        )}
      </Card>
    </div>
  )
}
