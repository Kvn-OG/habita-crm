import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { ChevronRight, Handshake, Plus } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '@/auth/AuthContext'
import { EmptyState } from '@/components/feedback/EmptyState'
import { ErrorState } from '@/components/feedback/ErrorState'
import { FilterSelect, SearchInput } from '@/components/forms/SearchInput'
import { PageHeader } from '@/components/layout/PageHeader'
import { Avatar } from '@/components/ui/Avatar'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { DataTable, type Column } from '@/components/ui/DataTable'
import { TableSkeleton } from '@/components/ui/Feedback'
import { Pagination } from '@/components/ui/Pagination'
import { PipelineBadge } from '@/features/leads/components/LeadBadges'
import { useDebouncedValue } from '@/hooks/useDebouncedValue'
import { useListParams } from '@/hooks/useListParams'
import { memberName, useTeamMembers } from '@/hooks/useTeamMembers'
import { formatDate } from '@/lib/format'
import { pipelineLabels, toOptions } from '@/lib/labels'
import { dealKeys, DEALS_PAGE_SIZE, listDeals } from './api'
import { DealAmount, dealPropertyLabel, DealStatusBadge } from './components/DealBadges'
import { DealFormModal } from './components/DealFormModal'
import type { DealOverview } from './types'

const FILTER_KEYS = ['q', 'situacao', 'tipo', 'responsavel'] as const

/** Previsão para negociações em andamento; data de encerramento para as demais. */
function DealDate({ deal }: { deal: DealOverview }) {
  if (deal.status !== 'em_andamento') return <span className="tabular text-muted">{formatDate(deal.closed_at)}</span>
  if (!deal.expected_close_date) return <span className="text-subtle">—</span>
  const date = new Date(`${deal.expected_close_date}T23:59:59`)
  const overdue = date.getTime() < new Date().getTime()
  return (
    <span className={overdue ? 'tabular font-medium text-danger-700' : 'tabular text-ink'}>
      {formatDate(date)}
      {overdue && <span className="sr-only"> (atrasada)</span>}
    </span>
  )
}

const columns: Column<DealOverview>[] = [
  {
    key: 'contact',
    header: 'Cliente',
    cell: (deal) => (
      <div className="min-w-0">
        <Link to={`/negociacoes/${deal.id}`} className="block truncate font-medium text-ink hover:text-brand-800 hover:underline">
          {deal.contact_name}
        </Link>
        <span className="block max-w-64 truncate text-xs text-muted">{dealPropertyLabel(deal) ?? 'Sem imóvel definido'}</span>
      </div>
    ),
  },
  { key: 'type', header: 'Tipo', cell: (deal) => <PipelineBadge pipeline={deal.deal_type} /> },
  { key: 'amount', header: 'Valor', className: 'whitespace-nowrap', cell: (deal) => <DealAmount deal={deal} /> },
  { key: 'status', header: 'Situação', cell: (deal) => <DealStatusBadge status={deal.status} /> },
  {
    key: 'assignee',
    header: 'Responsável',
    hideOnTablet: true,
    cell: (deal) =>
      deal.assignee_name ? (
        <span className="flex items-center gap-2">
          <Avatar name={deal.assignee_name} size="xs" />
          <span className="truncate text-xs">{deal.assignee_name}</span>
        </span>
      ) : (
        <span className="text-xs text-subtle">Sem responsável</span>
      ),
  },
  {
    key: 'date',
    header: 'Previsão / encerramento',
    hideOnTablet: true,
    className: 'text-xs whitespace-nowrap',
    cell: (deal) => <DealDate deal={deal} />,
  },
  {
    key: 'actions',
    header: <span className="sr-only">Ações</span>,
    className: 'w-12 text-right',
    cell: (deal) => (
      <Link
        to={`/negociacoes/${deal.id}`}
        className="inline-grid size-8 place-items-center rounded-md text-subtle transition-colors hover:bg-hover hover:text-ink"
        aria-label={`Ver negociação de ${deal.contact_name}`}
      >
        <ChevronRight className="size-4" />
      </Link>
    ),
  },
]

export function DealsPage() {
  const navigate = useNavigate()
  const { profile, permissions } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const { values, page, set, hasFilters } = useListParams(FILTER_KEYS)
  const [term, setTerm] = useState(values.q)
  const debouncedTerm = useDebouncedValue(term, 350)
  const [creating, setCreating] = useState(() => searchParams.get('novo') === '1')
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

  const query = useQuery({
    queryKey: dealKeys.list(values, page),
    queryFn: () => listDeals(values, page, profile?.id),
    placeholderData: keepPreviousData,
  })

  const clearFilters = () => {
    setTerm('')
    set({ q: null, situacao: null, tipo: null, responsavel: null })
  }

  const ownerOptions = [
    { value: 'eu', label: 'Minhas negociações' },
    { value: 'nenhum', label: 'Sem responsável' },
    ...(teamQuery.data ?? []).filter((member) => member.id !== profile?.id).map((member) => ({ value: member.id, label: memberName(member) })),
  ]

  return (
    <>
      <PageHeader
        description="Negociações de venda e locação com propostas, contrapropostas e fechamento."
        actions={
          <Button icon={<Plus />} onClick={() => setCreating(true)}>
            Nova negociação
          </Button>
        }
      />

      <Card>
        <div className="flex flex-col gap-3 p-4 xl:flex-row xl:items-center">
          <SearchInput className="xl:max-w-xs xl:flex-1" label="Buscar negociações" placeholder="Cliente ou código do imóvel" value={term} onChange={setTerm} />
          <div className="grid grid-cols-1 gap-2 sm:flex sm:flex-wrap xl:ml-auto">
            <FilterSelect
              label="Filtrar por situação"
              allLabel="Em andamento"
              value={values.situacao}
              onChange={(situacao) => set({ situacao })}
              options={[
                { value: 'ganho', label: 'Ganhas' },
                { value: 'perdido', label: 'Perdidas' },
                { value: 'cancelado', label: 'Canceladas' },
                { value: 'todas', label: 'Todas' },
              ]}
            />
            <FilterSelect label="Filtrar por tipo" allLabel="Venda e locação" value={values.tipo} onChange={(tipo) => set({ tipo })} options={toOptions(pipelineLabels)} />
            {/* Corretores só enxergam a própria carteira: o filtro por responsável é da gestão. */}
            {permissions.canViewReports && (
              <FilterSelect label="Filtrar por responsável" allLabel="Toda a equipe" value={values.responsavel} onChange={(responsavel) => set({ responsavel })} options={ownerOptions} />
            )}
            {hasFilters && (
              <Button variant="ghost" onClick={clearFilters}>
                Limpar
              </Button>
            )}
          </div>
        </div>

        <div className="border-t border-line">
          {query.isLoading ? (
            <TableSkeleton />
          ) : query.isError ? (
            <ErrorState error={query.error} onRetry={() => void query.refetch()} />
          ) : query.data && query.data.rows.length > 0 ? (
            <div className={query.isFetching ? 'opacity-70 transition-opacity' : undefined}>
              <DataTable
                caption="Lista de negociações"
                rows={query.data.rows}
                columns={columns}
                rowKey={(deal) => deal.id}
                onRowClick={(deal) => navigate(`/negociacoes/${deal.id}`)}
                mobileItem={(deal) => (
                  <Link to={`/negociacoes/${deal.id}`} className="block px-4 py-3.5 active:bg-hover">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-[13px] font-medium text-ink">{deal.contact_name}</p>
                        <p className="truncate text-xs text-muted">{dealPropertyLabel(deal) ?? pipelineLabels[deal.deal_type]}</p>
                      </div>
                      <DealStatusBadge status={deal.status} />
                    </div>
                    <p className="mt-1.5 text-xs text-muted">
                      <DealAmount deal={deal} />
                    </p>
                  </Link>
                )}
              />
              <Pagination page={page} pageSize={DEALS_PAGE_SIZE} total={query.data.count} onPageChange={(pagina) => set({ pagina })} />
            </div>
          ) : hasFilters ? (
            <EmptyState
              icon={<Handshake />}
              title="Nenhuma negociação encontrada"
              description="Ajuste a busca ou os filtros para ver outras negociações."
              action={
                <Button variant="secondary" onClick={clearFilters}>
                  Limpar filtros
                </Button>
              }
            />
          ) : (
            <EmptyState
              icon={<Handshake />}
              title="Nenhuma negociação em andamento"
              description="Abra uma negociação quando um lead chegar à etapa de proposta para registrar valores e o fechamento."
              action={
                <Button icon={<Plus />} onClick={() => setCreating(true)}>
                  Abrir negociação
                </Button>
              }
            />
          )}
        </div>
      </Card>

      <DealFormModal open={creating} onClose={() => setCreating(false)} onSaved={(id) => navigate(`/negociacoes/${id}`)} />
    </>
  )
}
