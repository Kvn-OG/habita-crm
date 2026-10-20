import { Clock3, LogOut, RefreshCw, ShieldAlert } from 'lucide-react'
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import { LoadingScreen } from '@/components/ui/Feedback'
import { useAuth } from './AuthContext'
import { AuthLayout } from './AuthLayout'

/** Exige sessão válida e perfil ativo para acessar as rotas internas. */
export function ProtectedRoute() {
  const { initializing, session, profileState, recoveryMode } = useAuth()
  const location = useLocation()

  if (initializing) return <LoadingScreen label="Verificando sua sessão" />
  if (!session) return <Navigate to="/entrar" replace state={{ from: location.pathname + location.search }} />
  if (recoveryMode) return <Navigate to="/redefinir-senha" replace />

  if (profileState.status === 'idle' || profileState.status === 'loading') {
    return <LoadingScreen label="Carregando seu perfil" />
  }
  if (profileState.status === 'error') {
    return <AccessProblem title="Não foi possível carregar seu perfil" description={profileState.message} retry />
  }
  if (profileState.status === 'missing') {
    return (
      <AccessProblem
        title="Perfil não encontrado"
        description="Sua conta existe, mas não possui um perfil no CRM. Peça ao administrador para verificar a configuração do banco de dados."
      />
    )
  }
  if (!profileState.profile.is_active) {
    return (
      <AccessProblem
        pending
        title="Acesso aguardando liberação"
        description="Sua conta foi criada, mas ainda precisa ser ativada por um administrador da imobiliária. Assim que o acesso for liberado, clique em “Verificar novamente”."
        retry
      />
    )
  }

  return <Outlet />
}

function AccessProblem({
  title,
  description,
  retry = false,
  pending = false,
}: {
  title: string
  description: string
  retry?: boolean
  pending?: boolean
}) {
  const { signOut, refreshProfile, user } = useAuth()
  return (
    <AuthLayout>
      <span
        className={`grid size-11 place-items-center rounded-full ${pending ? 'bg-accent-50 text-accent-700' : 'bg-danger-50 text-danger-700'}`}
        aria-hidden="true"
      >
        {pending ? <Clock3 className="size-5" /> : <ShieldAlert className="size-5" />}
      </span>
      <h2 className="mt-4 text-lg font-semibold text-ink">{title}</h2>
      <p className="mt-2 text-[13px] leading-relaxed text-muted">{description}</p>
      {user?.email && (
        <p className="mt-4 rounded-md bg-canvas px-3 py-2 text-xs text-muted">
          Conectado como <strong className="font-medium text-ink">{user.email}</strong>
        </p>
      )}
      <div className="mt-6 flex flex-col gap-2 sm:flex-row">
        {retry && (
          <Button variant="primary" className="flex-1" icon={<RefreshCw />} onClick={() => void refreshProfile()}>
            Verificar novamente
          </Button>
        )}
        <Button variant="secondary" className="flex-1" icon={<LogOut />} onClick={() => void signOut()}>
          Sair
        </Button>
      </div>
    </AuthLayout>
  )
}

/** Redireciona usuários já autenticados para fora das telas públicas. */
export function PublicOnlyRoute() {
  const { initializing, session, recoveryMode } = useAuth()
  if (initializing) return <LoadingScreen label="Verificando sua sessão" />
  if (session && recoveryMode) return <Navigate to="/redefinir-senha" replace />
  if (session) return <Navigate to="/" replace />
  return <Outlet />
}
