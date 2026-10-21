import {
  Building2, CalendarDays, ChartColumn, ContactRound, Handshake, LayoutDashboard, Megaphone, Settings, Target, UsersRound,
  type LucideIcon,
} from 'lucide-react'

export type NavItem = {
  to: string
  label: string
  icon: LucideIcon
  end?: boolean
  /** Visível apenas para administradores. */
  adminOnly?: boolean
}

export const mainNavigation: NavItem[] = [
  { to: '/', label: 'Visão geral', icon: LayoutDashboard, end: true },
  { to: '/leads', label: 'Leads', icon: Target },
  { to: '/imoveis', label: 'Imóveis', icon: Building2 },
  { to: '/contatos', label: 'Contatos', icon: ContactRound },
  { to: '/agenda', label: 'Agenda', icon: CalendarDays },
  { to: '/negociacoes', label: 'Negociações', icon: Handshake },
  { to: '/relatorios', label: 'Relatórios', icon: ChartColumn, adminOnly: true },
  { to: '/marketing', label: 'Marketing', icon: Megaphone, adminOnly: true },
]

export const secondaryNavigation: NavItem[] = [
  { to: '/acessos', label: 'Acessos', icon: UsersRound, adminOnly: true },
  { to: '/configuracoes', label: 'Configurações', icon: Settings },
]

/** Metadados de rota usados pelo cabeçalho (título e breadcrumbs). */
export type RouteHandle = {
  title: string
  crumb?: string
}
