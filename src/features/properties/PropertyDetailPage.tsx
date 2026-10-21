import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Bath, BedDouble, Car, Pencil, Ruler, Trash2, UserRound } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '@/auth/AuthContext'
import { EmptyState } from '@/components/feedback/EmptyState'
import { ErrorState } from '@/components/feedback/ErrorState'
import { useToast } from '@/components/feedback/Toast'
import { Badge } from '@/components/ui/Badge'
import { Button, ButtonLink } from '@/components/ui/Button'
import { Card, CardBody, CardHeader } from '@/components/ui/Card'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { DetailItem, DetailList } from '@/components/ui/DetailList'
import { LoadingScreen, Spinner } from '@/components/ui/Feedback'
import { LeadStageBadge } from '@/features/leads/components/LeadBadges'
import { getErrorMessage } from '@/lib/errors'
import { formatArea, formatCurrency, formatDate, formatNumber, formatPhone } from '@/lib/format'
import { pipelineLabels, propertyTypeLabels } from '@/lib/labels'
import { deleteProperty, getProperty, listPropertyInterestedLeads, propertyKeys } from './api'
import { PropertyImagesManager } from './components/PropertyImagesManager'
import { PropertyStatusBadge, PurposeBadge } from './components/PropertyBadges'

function Feature({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3 rounded-md border border-line bg-canvas/60 px-3 py-2.5">
      <span className="text-brand-700 [&_svg]:size-[18px]" aria-hidden="true">
        {icon}
      </span>
      <div className="min-w-0">
        <p className="text-[11px] text-muted">{label}</p>
        <p className="text-[13px] font-semibold text-ink tabular">{value}</p>
      </div>
    </div>
  )
}

export function PropertyDetailPage() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const toast = useToast()
  const { permissions } = useAuth()
  const [confirmDelete, setConfirmDelete] = useState(false)

  const query = useQuery({ queryKey: propertyKeys.detail(id), queryFn: () => getProperty(id) })
  const leadsQuery = useQuery({ queryKey: propertyKeys.leads(id), queryFn: () => listPropertyInterestedLeads(id), enabled: query.isSuccess })

  const remove = useMutation({
    mutationFn: () => deleteProperty(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: propertyKeys.all })
      toast.success('Imóvel excluído.')
      navigate('/imoveis', { replace: true })
    },
    onError: (error) => {
      setConfirmDelete(false)
      toast.error('Não foi possível excluir o imóvel', getErrorMessage(error))
    },
  })

  if (query.isLoading) return <LoadingScreen label="Carregando imóvel" />
  if (query.isError || !query.data) {
    return (
      <Card>
        <ErrorState error={query.error} title="Imóvel não encontrado" onRetry={() => void query.refetch()} />
      </Card>
    )
  }

  const property = query.data

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <Link to="/imoveis" className="inline-flex items-center gap-1.5 text-xs font-medium text-muted hover:text-ink">
            <ArrowLeft className="size-3.5" aria-hidden="true" /> Imóveis
          </Link>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Badge tone="brand" className="font-mono">
              {property.code}
            </Badge>
            <PropertyStatusBadge status={property.status} />
            <PurposeBadge purpose={property.purpose} />
          </div>
          <h2 className="mt-2 text-xl font-semibold tracking-tight text-balance text-ink">{property.title}</h2>
          <p className="mt-1 text-[13px] text-muted">
            {propertyTypeLabels[property.property_type]}
            {property.neighborhood && ` · ${property.neighborhood}`}
            {property.city && ` · ${property.city}`}
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          {permissions.canDelete && (
            <Button variant="danger-ghost" icon={<Trash2 />} onClick={() => setConfirmDelete(true)}>
              Excluir
            </Button>
          )}
          <ButtonLink to={`/imoveis/${property.id}/editar`} variant="secondary" icon={<Pencil />}>
            Editar
          </ButtonLink>
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0 space-y-5">
          <Card>
            <CardHeader title="Fotos" />
            <CardBody>
              <PropertyImagesManager propertyId={property.id} />
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Características" />
            <CardBody className="space-y-5">
              <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                <Feature icon={<BedDouble />} label="Quartos" value={property.suites ? `${formatNumber(property.bedrooms)} (${formatNumber(property.suites)} suíte${property.suites > 1 ? 's' : ''})` : formatNumber(property.bedrooms)} />
                <Feature icon={<Bath />} label="Banheiros" value={formatNumber(property.bathrooms)} />
                <Feature icon={<Car />} label="Vagas" value={formatNumber(property.parking_spaces)} />
                <Feature icon={<Ruler />} label="Área construída" value={formatArea(property.built_area)} />
              </div>
              <DetailList columns={3}>
                <DetailItem label="Área do terreno">{formatArea(property.land_area)}</DetailItem>
                <DetailItem label="Área construída / privativa">{formatArea(property.built_area)}</DetailItem>
                <DetailItem label="Tipo">{propertyTypeLabels[property.property_type]}</DetailItem>
              </DetailList>
              {property.description && (
                <div>
                  <h3 className="text-xs text-muted">Descrição</h3>
                  <p className="mt-1 text-[13px] leading-relaxed whitespace-pre-line text-ink">{property.description}</p>
                </div>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Localização" />
            <CardBody>
              <DetailList columns={3}>
                <DetailItem label="Estado">{property.state}</DetailItem>
                <DetailItem label="Cidade">{property.city}</DetailItem>
                <DetailItem label="Bairro">{property.neighborhood}</DetailItem>
              </DetailList>
            </CardBody>
          </Card>
        </div>

        <div className="space-y-5">
          <Card>
            <CardHeader title="Valores" />
            <CardBody>
              <DetailList columns={1}>
                {property.purpose !== 'locacao' && (
                  <DetailItem label="Valor de venda">
                    <span className="text-lg font-semibold tabular text-brand-900">{formatCurrency(property.sale_price)}</span>
                  </DetailItem>
                )}
                {property.purpose !== 'venda' && (
                  <DetailItem label="Aluguel mensal">
                    <span className="text-lg font-semibold tabular text-brand-900">{formatCurrency(property.rent_price)}</span>
                  </DetailItem>
                )}
                <DetailItem label="Condomínio (mensal)">{property.condo_fee !== null ? formatCurrency(property.condo_fee) : null}</DetailItem>
                <DetailItem label="IPTU (anual)">{property.iptu !== null ? formatCurrency(property.iptu) : null}</DetailItem>
              </DetailList>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Proprietários" />
            {property.owners.length ? (
              <ul className="divide-y divide-line">
                {property.owners.map((owner) => (
                  <li key={owner.id}>
                    <Link to={`/contatos/${owner.id}`} className="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-hover">
                      <UserRound className="size-4 text-subtle" aria-hidden="true" />
                      <span className="min-w-0">
                        <span className="block truncate text-[13px] font-medium text-ink">{owner.full_name}</span>
                        <span className="block text-xs text-muted">{formatPhone(owner.phone)}</span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState compact title="Nenhum proprietário vinculado" description="Edite o imóvel para vincular proprietários." />
            )}
          </Card>

          <Card>
            <CardHeader title="Leads interessados" />
            {leadsQuery.isLoading ? (
              <div className="grid place-items-center py-8">
                <Spinner />
              </div>
            ) : leadsQuery.isError ? (
              <ErrorState compact error={leadsQuery.error} onRetry={() => void leadsQuery.refetch()} />
            ) : leadsQuery.data?.length ? (
              <ul className="divide-y divide-line">
                {leadsQuery.data.map((lead) => (
                  <li key={lead.id}>
                    <Link to={`/leads/${lead.id}`} className="flex items-center justify-between gap-3 px-5 py-3 transition-colors hover:bg-hover">
                      <span className="min-w-0">
                        <span className="block truncate text-[13px] font-medium text-ink">{lead.contact_name}</span>
                        <span className="block text-xs text-muted">{pipelineLabels[lead.purpose]}</span>
                      </span>
                      <LeadStageBadge name={lead.stage_name} category={lead.stage_category} />
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState compact title="Nenhum lead interessado" description="Associe este imóvel aos leads na tela de leads." />
            )}
          </Card>

          <p className="px-1 text-xs text-muted">
            Cadastrado em {formatDate(property.created_at)}
            {property.creator_name && ` por ${property.creator_name}`}. Última atualização em {formatDate(property.updated_at)}.
          </p>
        </div>
      </div>

      <ConfirmDialog
        open={confirmDelete}
        title="Excluir imóvel?"
        description={
          <>
            O imóvel <strong className="text-ink">{property.code}</strong>, suas fotos e os vínculos com proprietários e leads serão removidos permanentemente. Esta ação não pode ser desfeita.
          </>
        }
        confirmLabel="Excluir imóvel"
        loading={remove.isPending}
        onConfirm={() => remove.mutate()}
        onCancel={() => setConfirmDelete(false)}
      />
    </div>
  )
}
