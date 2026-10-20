import { Suspense, useEffect, useState } from 'react'
import { Outlet, useLocation, useNavigation } from 'react-router-dom'
import { useAuth } from '@/auth/AuthContext'
import { Alert } from '@/components/feedback/Alert'
import { ButtonLink } from '@/components/ui/Button'
import { LoadingScreen } from '@/components/ui/Feedback'
import { Sidebar } from './Sidebar'
import { Topbar } from './Topbar'

const COLLAPSED_KEY = 'crm:menu-recolhido'

function readCollapsed() {
  try {
    return localStorage.getItem(COLLAPSED_KEY) === '1'
  } catch {
    return false
  }
}

export function AppLayout() {
  const [mobileOpen, setMobileOpen] = useState(false)
  const [collapsed, setCollapsed] = useState(readCollapsed)

  const toggleCollapsed = () => {
    setCollapsed((value) => {
      const next = !value
      try {
        localStorage.setItem(COLLAPSED_KEY, next ? '1' : '0')
      } catch {
        // Armazenamento indisponível: a preferência vale só nesta sessão.
      }
      return next
    })
  }
  const location = useLocation()
  const navigation = useNavigation()
  const { user } = useAuth()
  const mustChangePassword = user?.user_metadata?.must_change_password === true

  // Fecha o menu do celular com Esc.
  useEffect(() => {
    if (!mobileOpen) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMobileOpen(false)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [mobileOpen])

  // Rola para o topo ao trocar de página.
  useEffect(() => {
    window.scrollTo({ top: 0 })
  }, [location.pathname])

  return (
    <div className="flex min-h-dvh">
      <a
        href="#conteudo"
        className="sr-only z-[70] rounded-md bg-brand-900 px-4 py-2 text-white focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
      >
        Pular para o conteúdo
      </a>
      <Sidebar mobileOpen={mobileOpen} onClose={() => setMobileOpen(false)} collapsed={collapsed} />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar onOpenMenu={() => setMobileOpen(true)} menuOpen={mobileOpen} collapsed={collapsed} onToggleCollapsed={toggleCollapsed} />
        {navigation.state === 'loading' && (
          <div className="fixed inset-x-0 top-0 z-[70] h-0.5 animate-pulse bg-accent-500" role="progressbar" aria-label="Carregando página" />
        )}
        <main id="conteudo" className="flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-7">
          {mustChangePassword && location.search !== '?aba=perfil' && (
            <Alert
              tone="warning"
              className="mb-5"
              title="Você está usando uma senha provisória"
              action={
                <ButtonLink to="/configuracoes?aba=perfil" size="sm" variant="secondary">
                  Alterar minha senha
                </ButtonLink>
              }
            >
              Por segurança, defina uma senha pessoal antes de continuar usando o Habita.
            </Alert>
          )}
          <Suspense fallback={<LoadingScreen />}>
            <Outlet />
          </Suspense>
        </main>
      </div>
    </div>
  )
}
