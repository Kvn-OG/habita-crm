import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { BedDouble, Building2, ChevronRight, Plus, Ruler } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { EmptyState } from '@/components/feedback/EmptyState'
import { ErrorState } from '@/components/feedback/ErrorState'
import { FilterSelect, SearchInput } from '@/components/forms/SearchInput'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button, ButtonLink } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { DataTable, type Column } from '@/components/ui/DataTable'
import { TableSkeleton } from '@/components/ui/Feedback'
import { Pagination } from '@/components/ui/Pagination'
import { useDebouncedValue } from '@/hooks/useDebouncedValue'
import { useListParams } from '@/hooks/useListParams'
import { formatArea, formatNumber } from '@/lib/format'
import { propertyPurposeLabels, propertyStatusLabels, propertyTypeLabels, toOptions } from '@/lib/labels'
import { listProperties, propertyKeys, PROPERTIES_PAGE_SIZE } from './api'
import { formatAddress, PropertyPrice, PropertyStatusBadge, PurposeBadge } from './components/PropertyBadges'
import type { PropertyListItem } from './types'

const FILTER_KEYS = ['q', 'finalidade', 'tipo', 'situacao'] as const

const columns: Column<PropertyListItem>[] = [
  {
    key: 'code',
    header: 'Código',
    className: 'w-28',
    cell: (property) => <span className="font-mono text-xs font-semibold text-brand-800">{property.code}</span>,
  },
  {
    key: 'title',
    header: 'Imóvel',
    cell: (property) => (
      <div className="min-w-0 max-w-md">
        <Link to={`/imoveis/${property.id}`} className="block truncate font-medium text-ink hover:text-brand-800 hover:underline">
          {property.title}
        </Link>
        <span className="block truncate text-xs text-muted">{formatAddress(property)}</span>
      </div>
    ),
  },
  { key: 'type', header: 'Tipo', hideOnTablet: true, cell: (property) => <span className="text-muted">{propertyTypeLabels[property.property_type]}</span> },
  { key: 'purpose', header: 'Finalidade', cell: (property) => <PurposeBadge purpose={property.purpose} /> },
  {
    key: 'price',
    header: 'Valor',
    headerClassName: 'text-right',
    className: 'text-right font-medium whitespace-nowrap',
    cell: (property) => <PropertyPrice property={property} />,
  },
  { key: 'status', header: 'Situação', cell: (property) => <PropertyStatusBadge status={property.status} /> },
  {
    key: 'actions',
    header: <span className="sr-only">Ações</span>,
    className: 'w-12 text-right',
    cell: (property) => (
      <Link
        to={`/imoveis/${property.id}`}
        className="inline-grid size-8 place-items-center rounded-md text-subtle transition-colors hover:bg-hover hover:text-ink"
        aria-label={`Ver detalhes de ${property.code}`}
      >
        <ChevronRight className="size-4" />
      </Link>
    ),
  },
]

function MobileItem({ property }: { property: PropertyListItem }) {
  return (
    <Link to={`/imoveis/${property.id}`} className="block px-4 py-3.5 transition-colors active:bg-hover">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <span className="font-mono text-[11px] font-semibold text-brand-800">{property.code}</span>
          <p className="truncate text-[13px] font-medium text-ink">{property.title}</p>
          <p className="truncate text-xs text-muted">{formatAddress(property)}</p>
        </div>
        <PropertyStatusBadge status={property.status} />
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
        <span className="font-semibold text-ink">
          <PropertyPrice property={property} />
        </span>
        <span>{propertyTypeLabels[property.property_type]}</span>
        {property.bedrooms !== null && (
          <span className="inline-flex items-center gap-1">
            <BedDouble className="size-3.5" aria-hidden="true" /> {formatNumber(property.bedrooms)}
          </span>
        )}
        {property.built_area !== null && (
          <span className="inline-flex items-center gap-1">
            <Ruler className="size-3.5" aria-hidden="true" /> {formatArea(property.built_area)}
          </span>
        )}
      </div>
    </Link>
  )
}

export function PropertiesPage() {
  const navigate = useNavigate()
  const { values, page, set, hasFilters } = useListParams(FILTER_KEYS)
  const [term, setTerm] = useState(values.q)
  const debouncedTerm = useDebouncedValue(term, 350)

  useEffect(() => {
    if (debouncedTerm !== values.q) set({ q: debouncedTerm })
  }, [debouncedTerm, values.q, set])

  const query = useQuery({
    queryKey: propertyKeys.list(values, page),
    queryFn: () => listProperties(values, page),
    placeholderData: keepPreviousData,
  })

  const clearFilters = () => {
    setTerm('')
    set({ q: null, finalidade: null, tipo: null, situacao: null })
  }

  return (
    <>
      <PageHeader
        description="Carteira de imóveis da imobiliária, para venda e locação."
        actions={
          <ButtonLink to="/imoveis/novo" icon={<Plus />}>
            Novo imóvel
          </ButtonLink>
        }
      />

      <Card>
        <div className="flex flex-col gap-3 border-b border-line p-4 lg:flex-row lg:items-center">
          <SearchInput
            className="lg:max-w-sm lg:flex-1"
            label="Buscar imóveis"
            placeholder="Código, título ou endereço"
            value={term}
            onChange={setTerm}
          />
          <div className="grid grid-cols-1 gap-2 sm:flex sm:flex-wrap lg:ml-auto">
            <FilterSelect label="Filtrar por finalidade" allLabel="Todas as finalidades" value={values.finalidade} onChange={(finalidade) => set({ finalidade })} options={toOptions(propertyPurposeLabels)} />
            <FilterSelect label="Filtrar por tipo" allLabel="Todos os tipos" value={values.tipo} onChange={(tipo) => set({ tipo })} options={toOptions(propertyTypeLabels)} />
            <FilterSelect label="Filtrar por situação" allLabel="Todas as situações" value={values.situacao} onChange={(situacao) => set({ situacao })} options={toOptions(propertyStatusLabels)} />
            {hasFilters && (
              <Button variant="ghost" onClick={clearFilters}>
                Limpar filtros
              </Button>
            )}
          </div>
        </div>

        {query.isLoading ? (
          <TableSkeleton />
        ) : query.isError ? (
          <ErrorState error={query.error} onRetry={() => void query.refetch()} />
        ) : query.data && query.data.rows.length > 0 ? (
          <div className={query.isFetching ? 'opacity-70 transition-opacity' : undefined}>
            <DataTable
              caption="Lista de imóveis"
              rows={query.data.rows}
              columns={columns}
              rowKey={(property) => property.id}
              onRowClick={(property) => navigate(`/imoveis/${property.id}`)}
              mobileItem={(property) => <MobileItem property={property} />}
            />
            <Pagination page={page} pageSize={PROPERTIES_PAGE_SIZE} total={query.data.count} onPageChange={(pagina) => set({ pagina })} />
          </div>
        ) : hasFilters ? (
          <EmptyState
            icon={<Building2 />}
            title="Nenhum imóvel encontrado"
            description="Nenhum imóvel corresponde à busca ou aos filtros aplicados."
            action={
              <Button variant="secondary" onClick={clearFilters}>
                Limpar filtros
              </Button>
            }
          />
        ) : (
          <EmptyState
            icon={<Building2 />}
            title="Nenhum imóvel cadastrado"
            description="Cadastre o primeiro imóvel da carteira com valores, características, proprietários e fotos."
            action={
              <ButtonLink to="/imoveis/novo" icon={<Plus />}>
                Cadastrar imóvel
              </ButtonLink>
            }
          />
        )}
      </Card>
    </>
  )
}
