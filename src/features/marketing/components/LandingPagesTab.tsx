import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ExternalLink, Pencil, Plug, Plus, Trash2, UserRound } from 'lucide-react'
import { useState } from 'react'
import { EmptyState } from '@/components/feedback/EmptyState'
import { ErrorState } from '@/components/feedback/ErrorState'
import { useToast } from '@/components/feedback/Toast'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card, CardHeader } from '@/components/ui/Card'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { TableSkeleton } from '@/components/ui/Feedback'
import { getErrorMessage } from '@/lib/errors'
import { formatCurrency, formatNumber, formatRelative } from '@/lib/format'
import { pipelineLabels } from '@/lib/labels'
import { deleteLandingPage, listLandingPages, marketingKeys } from '../api'
import { MAX_LANDING_PAGES, type LandingPageOverview } from '../types'
import { ConnectFormModal } from './ConnectFormModal'
import { LandingPageFormModal } from './LandingPageFormModal'

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[11px] text-muted">{label}</dt>
      <dd className="text-[15px] font-semibold text-ink tabular">{value}</dd>
    </div>
  )
}

export function LandingPagesTab() {
  const queryClient = useQueryClient()
  const toast = useToast()
  const query = useQuery({ queryKey: marketingKeys.landingPages, queryFn: listLandingPages })
  const [editing, setEditing] = useState<LandingPageOverview | null>(null)
  const [creating, setCreating] = useState(false)
  const [connecting, setConnecting] = useState<LandingPageOverview | null>(null)
  const [toDelete, setToDelete] = useState<LandingPageOverview | null>(null)

  const remove = useMutation({
    mutationFn: (page: LandingPageOverview) => deleteLandingPage(page.id),
    onSuccess: async (_data, page) => {
      await queryClient.invalidateQueries({ queryKey: marketingKeys.all })
      setToDelete(null)
      toast.success('Landing page excluída.', page.name)
    },
    onError: (error) => toast.error('Não foi possível excluir a landing page', getErrorMessage(error)),
  })

  const pages = query.data ?? []
  const full = pages.length >= MAX_LANDING_PAGES

  return (
    <>
      <Card>
        <CardHeader
          title="Landing pages"
          description={
            query.data
              ? `${pages.length} de ${MAX_LANDING_PAGES} páginas vinculadas. Cada uma envia os leads do formulário direto para o funil.`
              : 'Páginas criadas fora do CRM, cada uma com um propósito.'
          }
          actions={
            <Button icon={<Plus />} onClick={() => setCreating(true)} disabled={full} title={full ? `O limite é de ${MAX_LANDING_PAGES} landing pages` : undefined}>
              Nova landing page
            </Button>
          }
        />
        {query.isLoading ? (
          <TableSkeleton rows={3} />
        ) : query.isError ? (
          <ErrorState error={query.error} onRetry={() => void query.refetch()} />
        ) : pages.length === 0 ? (
          <EmptyState
            icon={<Plug />}
            title="Nenhuma landing page vinculada"
            description="Cadastre até 5 páginas (ex.: Minha Casa, Minha Vida, imóveis usados, lançamentos) para receber os leads de cada uma no CRM."
            action={
              <Button icon={<Plus />} onClick={() => setCreating(true)}>
                Nova landing page
              </Button>
            }
          />
        ) : (
          <ul className="divide-y divide-line">
            {pages.map((page) => (
              <li key={page.id} className="flex flex-col gap-4 px-5 py-4 lg:flex-row lg:items-center">
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-2 text-[13px] font-semibold text-ink">
                    <span className="truncate">{page.name}</span>
                    <Badge tone={page.is_active ? 'success' : 'neutral'} dot>
                      {page.is_active ? 'Recebendo leads' : 'Pausada'}
                    </Badge>
                    <Badge tone="brand">{pipelineLabels[page.pipeline]}</Badge>
                  </p>
                  <p className="mt-0.5 text-xs text-muted">{page.purpose}</p>
                  <p className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
                    {page.url && (
                      <a href={page.url} target="_blank" rel="noreferrer" className="inline-flex max-w-full items-center gap-1 font-medium text-brand-800 hover:underline">
                        <span className="truncate">{page.url.replace(/^https?:\/\//, '')}</span>
                        <ExternalLink className="size-3 shrink-0" aria-hidden="true" />
                      </a>
                    )}
                    <span className="inline-flex items-center gap-1">
                      <UserRound className="size-3" aria-hidden="true" /> {page.assignee_name || 'Sem responsável'}
                    </span>
                    <span>Último lead: {page.last_lead_at ? formatRelative(page.last_lead_at) : 'nenhum ainda'}</span>
                  </p>
                </div>
                <dl className="grid grid-cols-4 gap-4 lg:w-[22rem]">
                  <Stat label="Leads" value={formatNumber(page.leads_total)} />
                  <Stat label="30 dias" value={formatNumber(page.leads_30d)} />
                  <Stat label="Ganhos" value={formatNumber(page.deals_won)} />
                  <Stat label="Valor" value={formatCurrency(page.won_amount)} />
                </dl>
                <div className="flex flex-wrap gap-1.5 lg:shrink-0">
                  <Button size="sm" variant="secondary" icon={<Plug />} onClick={() => setConnecting(page)}>
                    Conectar formulário
                  </Button>
                  <Button size="sm" variant="ghost" icon={<Pencil />} onClick={() => setEditing(page)}>
                    Editar
                  </Button>
                  <Button size="sm" variant="danger-ghost" icon={<Trash2 />} onClick={() => setToDelete(page)}>
                    Excluir
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <LandingPageFormModal open={creating || editing !== null} page={editing} onClose={() => (setCreating(false), setEditing(null))} />
      <ConnectFormModal page={connecting} onClose={() => setConnecting(null)} />
      <ConfirmDialog
        open={toDelete !== null}
        title="Excluir landing page?"
        description={
          <>
            <strong className="text-ink">{toDelete?.name}</strong> deixará de enviar leads ao CRM. Os leads já recebidos continuam no funil.
          </>
        }
        confirmLabel="Excluir landing page"
        loading={remove.isPending}
        onConfirm={() => toDelete && remove.mutate(toDelete)}
        onCancel={() => setToDelete(null)}
      />
    </>
  )
}
