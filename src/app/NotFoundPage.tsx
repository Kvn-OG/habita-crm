import { Compass } from 'lucide-react'
import { EmptyState } from '@/components/feedback/EmptyState'
import { ButtonLink } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'

export function NotFoundPage() {
  return (
    <Card>
      <EmptyState
        icon={<Compass />}
        title="Página não encontrada"
        description="O endereço acessado não existe ou foi alterado."
        action={<ButtonLink to="/">Voltar para a Visão geral</ButtonLink>}
      />
    </Card>
  )
}
