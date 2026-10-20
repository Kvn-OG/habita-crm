import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { ChevronRight, Columns3, List, Plus, Target } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '@/auth/AuthContext'
import { Alert } from '@/components/feedback/Alert'
import { EmptyState } from '@/components/feedback/EmptyState'
import { ErrorState } from '@/components/feedback/ErrorState'
import { FilterSelect, SearchInput } from '@/components/forms/SearchInput'
import { PageHeader } from '@/components/layout/PageHeader'
import { Avatar } from '@/components/ui/Avatar'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { DataTable, type Column } from '@/components/ui/DataTable'
import { Skeleton, TableSkeleton } from '@/components/ui/Feedback'
import { Pagination } from '@/components/ui/Pagination'
import { SegmentedControl } from '@/components/ui/SegmentedControl'
import { useDebouncedValue } from '@/hooks/useDebouncedValue'
import { useListParams } from '@/hooks/useListParams'
import { memberName, useTeamMembers } from '@/hooks/useTeamMembers'
import { formatNumber, formatPhone } from '@/lib/format'
import { leadSourceLabels, pipelineLabels, toOptions } from '@/lib/labels'
import type { Pipeline } from '@/types/domain'
import { KANBAN_LIMIT, leadKeys, LEADS_PAGE_SIZE, listKanbanLeads, listLeads, useStages } from './api'
import { KanbanBoard } from './components/KanbanBoard'
import { FollowUpDate, formatBudget, LeadStageBadge, PipelineBadge } from './components/LeadBadges'
import { LeadFormModal } from './components/LeadFormModal'
import type { LeadFilters, LeadOverview } from './types'

const FILTER_KEYS = ['q', 'funil', 'etapa', 'origem', 'responsavel', 'situacao'] as const

const columns: Column<LeadOverview>[] = [
  {
    key: 'contact',
    header: 'Contato',
    cell: (lead) => (
      <div className="min-w-0">
        <Link to={`/leads/${lead.id}`} className="block truncate font-medium text-ink hover:text-brand-800 hover:underline">
          {lead.contact_name}
        </Link>
        <span className="block text-xs text-muted tabular">{formatPhone(lead.contact_phone)}</span>
      </div>
    ),
  },
  { key: 'purpose', header: 'Finalidade', cell: (lead) => <PipelineBadge pipeline={lead.purpose} /> },
  { key: 'stage', header: 'Etapa', cell: (lead) => <LeadStageBadge name={lead.stage_name} category={lead.stage_category} /> },
  {
    key: 'region',
    header: 'Região / orçamento',
    hideOnTablet: true,
    cell: (lead) => (
      <div className="max-w-56 min-w-0 text-xs">
        <span className="block truncate text-ink">{lead.desired_region ?? '—'}</span>
        <span className="block truncate text-muted">{formatBudget(lead.min_budget === null ? null : Number(lead.min_budget), lead.max_budget === null ? null : Number(lead.max_budget)) ?? 'Orçamento não informado'}</span>
      </div>
    ),
  },
  {
    key: 'assignee',
    header: 'Responsável',
    hideOnTablet: true,
    cell: (lead) =>
      lead.assignee_name ? (
        <span className="flex items-center gap-2">
          <Avatar name={lead.assignee_name} size="xs" />
          <span className="truncate text-xs">{lead.assignee_name}</span>
        </span>
      ) : (
        <span className="text-xs text-subtle">Sem responsável</span>
      ),
  },
  { key: 'follow', header: 'Próximo retorno', className: 'text-xs whitespace-nowrap', cell: (lead) => <FollowUpDate value={lead.next_follow_up_at} /> },
  {
    key: 'actions',
    header: <span className="sr-only">Ações</span>,
    className: 'w-12 text-right',
    cell: (lead) => (
      <Link
        to={`/leads/${lead.id}`}
        className="inline-grid size-8 place-items-center rounded-md text-subtle transition-colors hover:bg-hover hover:text-ink"
        aria-label={`Ver lead de ${lead.contact_name}`}
      >
        <ChevronRight className="size-4" />
      </Link>
    ),
  },
]

export function LeadsPage() {
  const navigate = useNavigate()
  const { profile } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const view = searchParams.get('visao') === 'funil' ? 'funil' : 'lista'
  const { values, page, set, hasFilters } = useListParams(FILTER_KEYS)
  const [term, setTerm] = useState(values.q)
  const debouncedTerm = useDebouncedValue(term, 350)
  const [creating, setCreating] = useState(() => searchParams.get('novo') === '1')
  const stagesQuery = useStages()
  const teamQuery = useTeamMembers()

  useEffect(() => {
    if (debouncedTerm !== values.q) set({ q: debouncedTerm })
  }, [debouncedTerm, values.q, set])

  useEffect(() => {
    if (searchParams.get('novo') === '1') {
      const next = new URLSearchParams(searchParams)
      next.delete('novo')
      setSearchParams(next, { replace: true })
    }
  }, [searchParams, setSearchParams])

  const pipeline: Pipeline = values.funil === 'locacao' ? 'locacao' : 'venda'
  const kanbanFilters: LeadFilters = { ...values, funil: pipeline, etapa: '', situacao: '' }

  const listQuery = useQuery({
    queryKey: leadKeys.list(values, page),
    queryFn: () => listLeads(values, page, profile?.id),
    placeholderData: keepPreviousData,
    enabled: view === 'lista',
  })
  const kanbanQuery = useQuery({
    queryKey: leadKeys.kanban(pipeline, kanbanFilters),
    queryFn: () => listKanbanLeads(pipeline, kanbanFilters, profile?.id),
    placeholderData: keepPreviousData,
    enabled: view === 'funil',
  })

  const setView = (next: 'lista' | 'funil') => {
    setSearchParams(
      (previous) => {
        const params = new URLSearchParams(previous)
        if (next === 'funil') {
          params.set('visao', 'funil')
          params.delete('etapa')
          params.delete('situacao')
          params.delete('pagina')
          if (!params.get('funil')) params.set('funil', 'venda')
        } else params.delete('visao')
        return params
      },
      { replace: true },
    )
  }

  const clearFilters = () => {
    setTerm('')
    set({ q: null, funil: view === 'funil' ? pipeline : null, etapa: null, origem: null, responsavel: null, situacao: null })
  }

  const stageOptions = (stagesQuery.data ?? [])
    .filter((stage) => stage.pipeline === values.funil)
    .map((stage) => ({ value: stage.id, label: stage.name }))
  const ownerOptions = [
    { value: 'eu', label: 'Meus leads' },
    { value: 'nenhum', label: 'Sem responsável' },
    ...(teamQuery.data ?? []).filter((member) => member.id !== profile?.id).map((member) => ({ value: member.id, label: memberName(member) })),
  ]
  const kanbanStages = (stagesQuery.data ?? []).filter((stage) => stage.pipeline === pipeline && stage.is_active)
  const listFiltersActive = hasFilters && !(view === 'funil' && !values.q && !values.origem && !values.responsavel)

  return (
    <>
      <PageHeader
        description="Oportunidades de venda e locação, do primeiro contato ao fechamento."
        actions={
          <>
            <SegmentedControl
              label="Modo de visualização"
              value={view}
              onChange={setView}
              options={[
                { value: 'lista', label: 'Lista', icon: <List /> },
                { value: 'funil', label: 'Funil', icon: <Columns3 /> },
              ]}
            />
            <Button icon={<Plus />} onClick={() => setCreating(true)}>
              Novo lead
            </Button>
          </>
        }
      />

      <Card className={view === 'funil' ? 'mb-4' : undefined}>
        <div className="flex flex-col gap-3 p-4 xl:flex-row xl:items-center">
          <SearchInput className="xl:max-w-xs xl:flex-1" label="Buscar leads" placeholder="Contato, telefone ou região" value={term} onChange={setTerm} />
          <div className="grid grid-cols-1 gap-2 sm:flex sm:flex-wrap xl:ml-auto">
            {view === 'funil' ? (
              <SegmentedControl
                label="Funil"
                value={pipeline}
                onChange={(funil) => set({ funil })}
                options={[
                  { value: 'venda', label: 'Venda' },
                  { value: 'locacao', label: 'Locação' },
                ]}
              />
            ) : (
              <>
                <FilterSelect label="Filtrar por finalidade" allLabel="Venda e locação" value={values.funil} onChange={(funil) => set({ funil, etapa: null })} options={toOptions(pipelineLabels)} />
                {values.funil && <FilterSelect label="Filtrar por etapa" allLabel="Todas as etapas" value={values.etapa} onChange={(etapa) => set({ etapa })} options={stageOptions} />}
                <FilterSelect
                  label="Filtrar por situação"
                  allLabel="Em andamento"
                  value={values.situacao}
                  onChange={(situacao) => set({ situacao })}
                  options={[
                    { value: 'concluidos', label: 'Concluídos' },
                    { value: 'perdidos', label: 'Perdidos' },
                    { value: 'todos', label: 'Todos' },
                  ]}
                />
              </>
            )}
            <FilterSelect label="Filtrar por origem" allLabel="Todas as origens" value={values.origem} onChange={(origem) => set({ origem })} options={toOptions(leadSourceLabels)} />
            <FilterSelect label="Filtrar por responsável" allLabel="Toda a equipe" value={values.responsavel} onChange={(responsavel) => set({ responsavel })} options={ownerOptions} />
            {listFiltersActive && (
              <Button variant="ghost" onClick={clearFilters}>
                Limpar
              </Button>
            )}
          </div>
        </div>

        {view === 'lista' && (
          <div className="border-t border-line">
            {listQuery.isLoading ? (
              <TableSkeleton />
            ) : listQuery.isError ? (
              <ErrorState error={listQuery.error} onRetry={() => void listQuery.refetch()} />
            ) : listQuery.data && listQuery.data.rows.length > 0 ? (
              <div className={listQuery.isFetching ? 'opacity-70 transition-opacity' : undefined}>
                <DataTable
                  caption="Lista de leads"
                  rows={listQuery.data.rows}
                  columns={columns}
                  rowKey={(lead) => lead.id}
                  onRowClick={(lead) => navigate(`/leads/${lead.id}`)}
                  mobileItem={(lead) => (
                    <Link to={`/leads/${lead.id}`} className="block px-4 py-3.5 active:bg-hover">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-[13px] font-medium text-ink">{lead.contact_name}</p>
                          <p className="truncate text-xs text-muted">{lead.desired_region ?? pipelineLabels[lead.purpose]}</p>
                        </div>
                        <LeadStageBadge name={lead.stage_name} category={lead.stage_category} />
                      </div>
                      {lead.next_follow_up_at && (
                        <p className="mt-1.5 text-xs text-muted">
                          Retorno: <FollowUpDate value={lead.next_follow_up_at} className="text-xs" />
                        </p>
                      )}
                    </Link>
                  )}
                />
                <Pagination page={page} pageSize={LEADS_PAGE_SIZE} total={listQuery.data.count} onPageChange={(pagina) => set({ pagina })} />
              </div>
            ) : hasFilters ? (
              <EmptyState
                icon={<Target />}
                title="Nenhum lead encontrado"
                description="Ajuste a busca ou os filtros para ver outras oportunidades."
                action={
                  <Button variant="secondary" onClick={clearFilters}>
                    Limpar filtros
                  </Button>
                }
              />
            ) : (
              <EmptyState
                icon={<Target />}
                title="Nenhum lead em andamento"
                description="Cadastre o primeiro lead para acompanhar a oportunidade pelo funil de venda ou locação."
                action={
                  <Button icon={<Plus />} onClick={() => setCreating(true)}>
                    Criar lead
                  </Button>
                }
              />
            )}
          </div>
        )}
      </Card>

      {view === 'funil' &&
        (kanbanQuery.isLoading || stagesQuery.isLoading ? (
          <div className="flex gap-3 overflow-hidden">
            {Array.from({ length: 4 }, (_, index) => (
              <Skeleton key={index} className="h-80 w-[272px] shrink-0" />
            ))}
          </div>
        ) : kanbanQuery.isError || stagesQuery.isError ? (
          <Card>
            <ErrorState error={kanbanQuery.error ?? stagesQuery.error} onRetry={() => void kanbanQuery.refetch()} />
          </Card>
        ) : kanbanQuery.data ? (
          <>
            {kanbanQuery.data.count > KANBAN_LIMIT && (
              <Alert tone="info" className="mb-3">
                Exibindo os {formatNumber(KANBAN_LIMIT)} leads movimentados mais recentemente de {formatNumber(kanbanQuery.data.count)}. Use a busca ou os filtros para refinar.
              </Alert>
            )}
            <KanbanBoard stages={kanbanStages} data={kanbanQuery.data} queryKey={leadKeys.kanban(pipeline, kanbanFilters)} />
          </>
        ) : null)}

      <LeadFormModal
        open={creating}
        onClose={() => setCreating(false)}
        defaultPurpose={values.funil === 'locacao' ? 'locacao' : 'venda'}
        onSaved={(id) => navigate(`/leads/${id}`)}
      />
    </>
  )
}
