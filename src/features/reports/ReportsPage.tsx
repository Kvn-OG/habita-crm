import { ChartColumn } from 'lucide-react'
import { PreparationPage } from '@/features/preparation/PreparationPage'

export function ReportsPage() {
  return (
    <PreparationPage
      icon={<ChartColumn />}
      title="Relatórios"
      description="Relatórios gerenciais sobre a carteira de imóveis e o desempenho comercial, calculados a partir dos dados registrados no CRM."
      upcoming={[
        'Conversão por etapa dos funis de venda e locação.',
        'Leads por origem (site, Instagram, WhatsApp, portais, indicação).',
        'Desempenho por corretor: leads atendidos, visitas e fechamentos.',
        'Tempo médio em cada etapa e motivos de perda.',
        'Exportação dos relatórios em planilha.',
      ]}
      meanwhile={{
        text: 'Os principais indicadores já estão disponíveis na Visão geral.',
        label: 'Ir para a Visão geral',
        to: '/',
      }}
    />
  )
}
