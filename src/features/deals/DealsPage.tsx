import { Handshake } from 'lucide-react'
import { PreparationPage } from '@/features/preparation/PreparationPage'

export function DealsPage() {
  return (
    <PreparationPage
      icon={<Handshake />}
      title="Negociações"
      description="Registro formal das negociações de venda e locação, com propostas, contrapropostas e histórico de valores vinculados a cada lead e imóvel."
      upcoming={[
        'Abertura de negociação a partir de um lead em etapa de proposta.',
        'Registro de propostas e contrapropostas com valores, validade e condições.',
        'Status da negociação (em andamento, ganha, perdida ou cancelada) com data de fechamento.',
        'Atualização automática da situação do imóvel ao concluir uma venda ou locação.',
      ]}
      meanwhile={{
        text: 'Enquanto isso, acompanhe propostas e negociações pelas etapas do funil de leads.',
        label: 'Abrir funil de leads',
        to: '/leads?visao=funil',
      }}
    />
  )
}
