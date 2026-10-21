import { LogOut, X } from 'lucide-react'
import { Link, NavLink } from 'react-router-dom'
import { mainNavigation, secondaryNavigation, type NavItem } from '@/app/navigation'
import { useAuth } from '@/auth/AuthContext'
import { UserAvatar } from '@/components/ui/Avatar'
import { IconButton } from '@/components/ui/Button'
import { roleLabels } from '@/lib/labels'
import { cn } from '@/lib/utils'
import { APP_NAME, APP_SLOGAN } from '@/app/brand'
import { BrandIcon, BrandLogo } from './BrandMark'

function NavEntry({ item, onNavigate, collapsed }: { item: NavItem; onNavigate: () => void; collapsed: boolean }) {
  const Icon = item.icon
  return (
    <NavLink
      to={item.to}
      end={item.end}
      onClick={onNavigate}
      title={collapsed ? item.label : undefined}
      className={({ isActive }) =>
        cn(
          'group relative flex h-9.5 items-center gap-3 rounded-md text-[13px] font-medium transition-colors',
          collapsed ? 'justify-center px-0' : 'px-3',
          isActive ? 'bg-mint/[0.12] text-white' : 'text-brand-200 hover:bg-white/[0.06] hover:text-white',
        )
      }
    >
      {({ isActive }) => (
        <>
          <span
            className={cn(
              'absolute top-2 bottom-2 left-0 w-[3px] rounded-r-full bg-mint transition-opacity',
              isActive ? 'opacity-100' : 'opacity-0',
            )}
            aria-hidden="true"
          />
          <Icon
            className={cn('size-[18px] shrink-0', isActive ? 'text-mint' : 'text-brand-200/80 group-hover:text-white')}
            strokeWidth={1.8}
            aria-hidden="true"
          />
          <span className={cn('flex-1 truncate', collapsed && 'sr-only')}>{item.label}</span>
        </>
      )}
    </NavLink>
  )
}

type SidebarProps = {
  mobileOpen: boolean
  onClose: () => void
  /** Modo recolhido (apenas ícones) — somente em telas grandes. */
  collapsed: boolean
}

export function Sidebar({ mobileOpen, onClose, collapsed: collapsedPreference }: SidebarProps) {
  const { profile, user, signOut, permissions } = useAuth()
  const visible = (item: NavItem) => !item.adminOnly || permissions.isAdmin
  const navigation = mainNavigation.filter(visible)
  const secondary = secondaryNavigation.filter(visible)
  const displayName = profile?.full_name.trim() || user?.email || 'Usuário'
  // No celular o menu aberto é sempre completo.
  const collapsed = collapsedPreference && !mobileOpen

  return (
    <>
      {mobileOpen && (
        <div className="fixed inset-0 z-40 animate-fade-in bg-brand-950/50 lg:hidden" onClick={onClose} aria-hidden="true" />
      )}
      <aside
        id="app-sidebar"
        aria-label="Menu lateral"
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex w-[264px] flex-col bg-brand-900 text-white transition-[transform,width] duration-200 lg:sticky lg:top-0 lg:h-dvh lg:translate-x-0',
          collapsed && 'lg:w-[72px]',
          mobileOpen ? 'translate-x-0 shadow-overlay' : '-translate-x-full',
        )}
      >
        <div className={cn('flex h-16 items-center gap-3 border-b border-white/[0.07]', collapsed ? 'justify-center px-0' : 'px-5')}>
          <Link
            to="/"
            onClick={onClose}
            className={cn('flex min-w-0 items-center gap-3 rounded-md focus-visible:outline-mint', !collapsed && 'flex-1')}
            aria-label={`${APP_NAME} — ir para a Visão geral`}
            title={collapsed ? 'Visão geral' : undefined}
          >
            {collapsed ? (
              <BrandIcon surface="dark" className="h-6" />
            ) : (
              <span className="flex min-w-0 flex-col items-start gap-1">
                <BrandLogo surface="dark" className="h-5" />
                <span className="block truncate text-[10.5px] font-medium tracking-wide text-brand-200">{APP_SLOGAN}</span>
              </span>
            )}
          </Link>
          <IconButton label="Fechar menu" onClick={onClose} className="text-brand-200 hover:bg-white/10 hover:text-white lg:hidden">
            <X />
          </IconButton>
        </div>

        <nav className={cn('flex flex-1 flex-col overflow-y-auto py-5', collapsed ? 'px-2.5' : 'px-3')} aria-label="Navegação principal">
          <p className={cn('mb-2 px-3 text-[10px] font-semibold tracking-[0.12em] text-brand-200/60 uppercase', collapsed && 'sr-only')}>Operação</p>
          <div className="space-y-0.5">
            {navigation.map((item) => (
              <NavEntry key={item.to} item={item} onNavigate={onClose} collapsed={collapsed} />
            ))}
          </div>
          <div className="mt-auto space-y-0.5 pt-6">
            {secondary.map((item) => (
              <NavEntry key={item.to} item={item} onNavigate={onClose} collapsed={collapsed} />
            ))}
          </div>
        </nav>

        <div className="border-t border-white/[0.07] p-3">
          <div className={cn('flex items-center gap-3 rounded-md py-2', collapsed ? 'flex-col px-0' : 'px-2')}>
            <span title={collapsed ? `${displayName} · ${profile ? roleLabels[profile.role] : ''}` : undefined}>
              <UserAvatar name={displayName} avatarPath={profile?.avatar_path} size="md" tone="accent" />
            </span>
            {!collapsed && (
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-medium">{displayName}</p>
                <p className="truncate text-[11px] text-brand-200">{profile ? roleLabels[profile.role] : ''}</p>
              </div>
            )}
            <IconButton label="Sair da conta" onClick={() => void signOut()} className="text-brand-200 hover:bg-white/10 hover:text-white">
              <LogOut />
            </IconButton>
          </div>
        </div>
      </aside>
    </>
  )
}
