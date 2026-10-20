import { Badge, type BadgeTone } from '@/components/ui/Badge'
import { formatCurrency } from '@/lib/format'
import { propertyPurposeLabels, propertyStatusLabels } from '@/lib/labels'
import type { PropertyPurpose, PropertyStatus } from '@/types/domain'
import type { Property } from '../types'

const statusTones: Record<PropertyStatus, BadgeTone> = {
  disponivel: 'success',
  reservado: 'accent',
  em_negociacao: 'info',
  vendido: 'brand',
  alugado: 'brand',
  indisponivel: 'neutral',
}

export function PropertyStatusBadge({ status }: { status: PropertyStatus }) {
  return (
    <Badge tone={statusTones[status]} dot>
      {propertyStatusLabels[status]}
    </Badge>
  )
}

export function PurposeBadge({ purpose }: { purpose: PropertyPurpose }) {
  return <Badge tone="neutral">{propertyPurposeLabels[purpose]}</Badge>
}

/** Valor principal exibido na listagem conforme a finalidade. */
export function PropertyPrice({ property }: { property: Pick<Property, 'purpose' | 'sale_price' | 'rent_price'> }) {
  if (property.purpose === 'locacao') {
    return (
      <span className="tabular">
        {formatCurrency(property.rent_price)}
        <span className="text-xs font-normal text-muted">/mês</span>
      </span>
    )
  }
  return (
    <span className="tabular">
      {formatCurrency(property.sale_price)}
      {property.purpose === 'ambos' && property.rent_price !== null && (
        <span className="block text-xs font-normal text-muted">ou {formatCurrency(property.rent_price)}/mês</span>
      )}
    </span>
  )
}

export function formatAddress(property: Pick<Property, 'street' | 'street_number' | 'neighborhood' | 'city'>, fallback = 'Endereço não informado') {
  const street = [property.street, property.street_number].filter(Boolean).join(', ')
  return [street, property.neighborhood, property.city].filter(Boolean).join(' · ') || fallback
}
