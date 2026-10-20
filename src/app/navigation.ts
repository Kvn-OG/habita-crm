import {
  Building2, CalendarDays, ChartColumn, ContactRound, Handshake, LayoutDashboard, Settings, Target, type LucideIcon,
} from 'lucide-react'

export type NavItem = {
  to: string
  label: string
  icon: LucideIcon
  end?: boolean
  /** Módulo ainda em preparação (exibe indicação discreta). */
  preparing?: boolean
}

export const mainNavigation: NavItem[] = [
  { to: '/', label: 'Visão geral', icon: LayoutDashboard, end: true },
  { to: '/leads', label: 'Leads', icon: Target },
  { to: '/imoveis', label: 'Imóveis', icon: Building2 },
  { to: '/contatos', label: 'Contatos', icon: ContactRound },
  { to: '/agenda', label: 'Agenda', icon: CalendarDays },
  { to: '/negociacoes', label: 'Negociações', icon: Handshake, preparing: true },
  { to: '/relatorios', label: 'Relatórios', icon: ChartColumn, preparing: true },
]

export const secondaryNavigation: NavItem[] = [{ to: '/configuracoes', label: 'Configurações', icon: Settings }]

/** Metadados de rota usados pelo cabeçalho (título e breadcrumbs). */
export type RouteHandle = {
  title: string
  crumb?: string
}
