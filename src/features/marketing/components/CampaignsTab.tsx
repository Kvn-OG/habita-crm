import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Megaphone, Pencil, Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { EmptyState } from '@/components/feedback/EmptyState'
import { ErrorState } from '@/components/feedback/ErrorState'
import { useToast } from '@/components/feedback/Toast'
import { FilterSelect } from '@/components/forms/SearchInput'
import { Badge } from '@/components/ui/Badge'
import { Button, IconButton } from '@/components/ui/Button'
import { Card, CardHeader } from '@/components/ui/Card'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { Skeleton, TableSkeleton } from '@/components/ui/Feedback'
import { getErrorMessage } from '@/lib/errors'
import { formatCurrency, formatDate, formatNumber } from '@/lib/format'
import { toOptions } from '@/lib/labels'
import { cn } from '@/lib/utils'
import { deleteCampaign, listCampaigns, marketingKeys } from '../api'
import { campaignPlatformShortLabels, campaignStatusLabels, campaignStatusTones } from '../labels'
import type { CampaignOverview } from '../types'
import { CampaignFormModal } from './CampaignFormModal'

function SummaryTile({ label, value, hint, loading }: { label: string; value: string; hint?: string; loading: boolean }) {
  return (
    <div className="rounded-lg border border-line bg-surface p-4 shadow-card">
      <p className="text-[13px] font-medium text-muted">{label}</p>
      {loading ? <Skeleton className="mt-2 h-7 w-20" /> : <p className="mt-1.5 text-[22px] leading-none font-semibold tracking-tight text-ink tabular">{value}</p>}
      {hint && <p className="mt-1.5 text-xs text-subtle">{hint}</p>}
    </div>
  )
}

function period(campaign: CampaignOverview) {
  if (!campaign.starts_on && !campaign.ends_on) return 'Sem período definido'
  if (!campaign.ends_on) return `Desde ${formatDate(campaign.starts_on)}`
  return `${formatDate(campaign.starts_on)} a ${formatDate(campaign.ends_on)}`
}

/** Barra de consumo do orçamento. */
function BudgetBar({ spent, budget }: { spent: number; budget: number | null }) {
  if (!budget) return null
  const ratio = Math.min(spent / budget, 1)
  return (
    <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-hover" title={`${Math.round((spent / budget) * 100)}% do orçamento`}>
      <div className={cn('h-full rounded-full', spent > budget ? 'bg-danger-600' : 'bg-accent-600')} style={{ width: `${ratio * 100}%` }} />
    </div>
  )
}

export function CampaignsTab() {
  const queryClient = useQueryClient()
  const toast = useToast()
  const query = useQuery({ queryKey: marketingKeys.campaigns, queryFn: listCampaigns })
  const [status, setStatus] = useState('')
  const [editing, setEditing] = useState<CampaignOverview | null>(null)
  const [creating, setCreating] = useState(false)
  const [toDelete, setToDelete] = useState<CampaignOverview | null>(null)

  const remove = useMutation({
    mutationFn: (campaign: CampaignOverview) => deleteCampaign(campaign.id),
    onSuccess: async (_data, campaign) => {
      await queryClient.invalidateQueries({ queryKey: marketingKeys.all })
      setToDelete(null)
      toast.success('Campanha excluída.', campaign.name)
    },
    onError: (error) => toast.error('Não foi possível excluir a campanha', getErrorMessage(error)),
  })

  const all = query.data ?? []
  const campaigns = status ? all.filter((campaign) => campaign.status === status) : all
  const spent = campaigns.reduce((sum, campaign) => sum + Number(campaign.spent), 0)
  const leads = campaigns.reduce((sum, campaign) => sum + campaign.leads, 0)
  const won = campaigns.reduce((sum, campaign) => sum + campaign.deals_won, 0)
  const wonAmount = campaigns.reduce((sum, campaign) => sum + Number(campaign.won_amount), 0)

  return (
    <div className="space-y-5">
      <section aria-label="Resumo das campanhas" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <SummaryTile label="Investido" value={formatCurrency(spent)} hint={status ? `Campanhas ${campaignStatusLabels[status as keyof typeof campaignStatusLabels].toLowerCase()}s` : 'Todas as campanhas'} loading={query.isLoading} />
        <SummaryTile label="Leads gerados" value={formatNumber(leads)} loading={query.isLoading} />
        <SummaryTile label="Custo por lead" value={leads ? formatCurrency(spent / leads) : '—'} loading={query.isLoading} />
        <SummaryTile label="Negócios ganhos" value={formatNumber(won)} hint={won ? formatCurrency(wonAmount) : undefined} loading={query.isLoading} />
      </section>

      <Card>
        <CardHeader
          title="Campanhas de tráfego pago"
          description="Investimento, alcance e leads de cada campanha. Os leads chegam pelas landing pages com o utm_campaign da campanha."
          actions={
            <>
              <FilterSelect label="Filtrar por situação" allLabel="Todas as situações" value={status} onChange={setStatus} options={toOptions(campaignStatusLabels)} />
              <Button icon={<Plus />} onClick={() => setCreating(true)}>
                Nova campanha
              </Button>
            </>
          }
        />
        {query.isLoading ? (
          <TableSkeleton rows={3} />
        ) : query.isError ? (
          <ErrorState error={query.error} onRetry={() => void query.refetch()} />
        ) : campaigns.length === 0 ? (
          <EmptyState
            icon={<Megaphone />}
            title={all.length ? 'Nenhuma campanha nesta situação' : 'Nenhuma campanha cadastrada'}
            description="Cadastre as campanhas do Meta Ads, Google Ads e outras plataformas para comparar custo por lead e retorno."
            action={
              !all.length && (
                <Button icon={<Plus />} onClick={() => setCreating(true)}>
                  Nova campanha
                </Button>
              )
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[56rem] text-left text-[13px]">
              <thead className="border-b border-line text-xs text-muted">
                <tr>
                  <th scope="col" className="px-5 py-2.5 font-medium">Campanha</th>
                  <th scope="col" className="px-3 py-2.5 font-medium">Situação</th>
                  <th scope="col" className="px-3 py-2.5 text-right font-medium">Investido</th>
                  <th scope="col" className="px-3 py-2.5 text-right font-medium">Cliques · CTR</th>
                  <th scope="col" className="px-3 py-2.5 text-right font-medium">Leads</th>
                  <th scope="col" className="px-3 py-2.5 text-right font-medium">Custo/lead</th>
                  <th scope="col" className="px-3 py-2.5 text-right font-medium">Ganhos</th>
                  <th scope="col" className="px-5 py-2.5"><span className="sr-only">Ações</span></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {campaigns.map((campaign) => {
                  const budget = campaign.budget === null ? null : Number(campaign.budget)
                  return (
                    <tr key={campaign.id} className="align-top">
                      <td className="px-5 py-3">
                        <p className="font-medium text-ink">{campaign.name}</p>
                        <p className="mt-0.5 text-xs text-muted">
                          {campaignPlatformShortLabels[campaign.platform]} · {period(campaign)}
                          {campaign.landing_page_name && ` · ${campaign.landing_page_name}`}
                        </p>
                        {campaign.utm_campaign && <code className="mt-1 inline-block text-[11px] text-subtle">utm_campaign={campaign.utm_campaign}</code>}
                      </td>
                      <td className="px-3 py-3">
                        <Badge tone={campaignStatusTones[campaign.status]} dot>
                          {campaignStatusLabels[campaign.status]}
                        </Badge>
                      </td>
                      <td className="px-3 py-3 text-right tabular">
                        <p className="text-ink">{formatCurrency(campaign.spent)}</p>
                        {budget !== null && <p className="text-xs text-muted">de {formatCurrency(budget)}</p>}
                        <BudgetBar spent={Number(campaign.spent)} budget={budget} />
                      </td>
                      <td className="px-3 py-3 text-right tabular">
                        <p className="text-ink">{formatNumber(campaign.clicks)}</p>
                        <p className="text-xs text-muted">{campaign.ctr === null ? '—' : `${formatNumber(campaign.ctr)}%`}</p>
                      </td>
                      <td className="px-3 py-3 text-right font-semibold text-ink tabular">{formatNumber(campaign.leads)}</td>
                      <td className="px-3 py-3 text-right tabular">{formatCurrency(campaign.cost_per_lead)}</td>
                      <td className="px-3 py-3 text-right tabular">
                        <p className="text-ink">{formatNumber(campaign.deals_won)}</p>
                        {campaign.deals_won > 0 && <p className="text-xs text-muted">{formatCurrency(campaign.won_amount)}</p>}
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex justify-end gap-1">
                          <IconButton label={`Editar ${campaign.name}`} onClick={() => setEditing(campaign)}>
                            <Pencil />
                          </IconButton>
                          <IconButton label={`Excluir ${campaign.name}`} variant="danger-ghost" onClick={() => setToDelete(campaign)}>
                            <Trash2 />
                          </IconButton>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <CampaignFormModal open={creating || editing !== null} campaign={editing} onClose={() => (setCreating(false), setEditing(null))} />
      <ConfirmDialog
        open={toDelete !== null}
        title="Excluir campanha?"
        description={
          <>
            <strong className="text-ink">{toDelete?.name}</strong> será excluída. Os leads continuam no funil, apenas sem o vínculo com a campanha.
          </>
        }
        confirmLabel="Excluir campanha"
        loading={remove.isPending}
        onConfirm={() => toDelete && remove.mutate(toDelete)}
        onCancel={() => setToDelete(null)}
      />
    </div>
  )
}
