import { Badge, type BadgeTone } from '@/components/ui/Badge'
import { contactTypeLabels } from '@/lib/labels'
import type { ContactType } from '@/types/domain'

const tones: Record<ContactType, BadgeTone> = {
  comprador: 'brand',
  interessado_locacao: 'info',
  proprietario: 'accent',
  outro: 'neutral',
}

export function ContactTypeBadge({ type }: { type: ContactType }) {
  return <Badge tone={tones[type]}>{contactTypeLabels[type]}</Badge>
}
