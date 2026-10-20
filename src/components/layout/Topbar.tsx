import { Bell, ChevronDown, ChevronRight, LogOut, Menu, PanelLeftClose, PanelLeftOpen, Search, UserRound } from 'lucide-react'
import { Link, useMatches, useNavigate, type UIMatch } from 'react-router-dom'
import type { RouteHandle } from '@/app/navigation'
import { useAuth } from '@/auth/AuthContext'
import { Avatar } from '@/components/ui/Avatar'
import { IconButton } from '@/components/ui/Button'
import { MenuItem, Popover } from '@/components/ui/Popover'
import { roleLabels } from '@/lib/labels'
import { cn } from '@/lib/utils'
import { GlobalSearch } from './GlobalSearch'

function useRouteMeta() {
  const matches = useMatches() as UIMatch<unknown, RouteHandle | undefined>[]
  const withHandle = matches.filter((match) => match.handle?.title)
  const current = withHandle[withHandle.length - 1]
  const crumbs = withHandle
    .filter((match) => match.handle?.crumb)
    .map((match) => ({ label: match.handle?.crumb as string, to: match.pathname }))
  return { title: current?.handle?.title ?? 'CRM', crumbs }
}

type TopbarProps = {
  onOpenMenu: () => void
  menuOpen: boolean
  collapsed: boolean
  onToggleCollapsed: () => void
}

export function Topbar({ onOpenMenu, menuOpen, collapsed, onToggleCollapsed }: TopbarProps) {
  const { title, crumbs } = useRouteMeta()
  const { profile, user, signOut } = useAuth()
  const navigate = useNavigate()
  const displayName = profile?.full_name.trim() || user?.email || 'Usuário'

  return (
    <header className="sticky top-0 z-30 border-b border-line bg-surface/95 backdrop-blur supports-[backdrop-filter]:bg-surface/85">
      <div className="flex h-16 items-center gap-3 px-4 sm:px-6 lg:px-8">
        <IconButton
          label="Abrir menu"
          size="icon"
          className="-ml-2 lg:hidden"
          onClick={onOpenMenu}
          aria-expanded={menuOpen}
          aria-controls="app-sidebar"
        >
          <Menu />
        </IconButton>
        <IconButton
          label={collapsed ? 'Expandir menu lateral' : 'Recolher menu lateral'}
          size="icon"
          className="-ml-2 hidden lg:inline-flex"
          onClick={onToggleCollapsed}
          aria-expanded={!collapsed}
          aria-controls="app-sidebar"
        >
          {collapsed ? <PanelLeftOpen /> : <PanelLeftClose />}
        </IconButton>

        <div className="min-w-0 flex-1">
          {crumbs.length > 1 && (
            <nav aria-label="Trilha de navegação" className="hidden sm:block">
              <ol className="flex items-center gap-1 text-[11px] text-muted">
                {crumbs.map((crumb, index) => {
                  const last = index === crumbs.length - 1
                  return (
                    <li key={crumb.to} className="flex items-center gap-1">
                      {index > 0 && <ChevronRight className="size-3 text-subtle" aria-hidden="true" />}
                      {last ? (
                        <span aria-current="page">{crumb.label}</span>
                      ) : (
                        <Link to={crumb.to} className="hover:text-ink">
                          {crumb.label}
                        </Link>
                      )}
                    </li>
                  )
                })}
              </ol>
            </nav>
          )}
          <h1 className={cn('truncate font-semibold tracking-tight text-ink', crumbs.length > 1 ? 'text-base sm:text-[15px]' : 'text-base')}>
            {title}
          </h1>
        </div>

        <GlobalSearch />

        <IconButton label="Pesquisar" size="icon" className="md:hidden" onClick={() => navigate('/busca')}>
          <Search />
        </IconButton>

        <Popover
          trigger={({ open, toggle, id }) => (
            <IconButton label="Notificações" size="icon" onClick={toggle} aria-expanded={open} aria-controls={id}>
              <Bell />
            </IconButton>
          )}
          className="w-72"
        >
          {() => (
            <div className="px-3 py-3">
              <p className="text-[13px] font-semibold text-ink">Notificações</p>
              <p className="mt-1.5 text-xs leading-relaxed text-muted">
                A central de notificações será disponibilizada em uma próxima etapa, com alertas de retornos, visitas e novos leads.
              </p>
            </div>
          )}
        </Popover>

        <Popover
          trigger={({ open, toggle, id }) => (
            <button
              type="button"
              onClick={toggle}
              aria-expanded={open}
              aria-controls={id}
              aria-label="Menu do usuário"
              className="flex items-center gap-2 rounded-md py-1 pr-1.5 pl-1 transition-colors hover:bg-hover"
            >
              <Avatar name={displayName} size="sm" tone="brand" />
              <span className="hidden max-w-36 truncate text-[13px] font-medium text-ink xl:block">{displayName}</span>
              <ChevronDown className="hidden size-4 text-subtle sm:block" aria-hidden="true" />
            </button>
          )}
        >
          {(close) => (
            <div>
              <div className="border-b border-line px-2.5 pt-1.5 pb-2.5">
                <p className="truncate text-[13px] font-medium text-ink">{displayName}</p>
                <p className="truncate text-xs text-muted">{user?.email}</p>
                {profile && <p className="mt-1 text-[11px] font-medium text-accent-700">{roleLabels[profile.role]}</p>}
              </div>
              <div className="pt-1">
                <MenuItem
                  icon={<UserRound />}
                  onClick={() => {
                    close()
                    navigate('/configuracoes?aba=perfil')
                  }}
                >
                  Meu perfil
                </MenuItem>
                <MenuItem icon={<LogOut />} tone="danger" onClick={() => void signOut()}>
                  Sair da conta
                </MenuItem>
              </div>
            </div>
          )}
        </Popover>
      </div>
    </header>
  )
}
