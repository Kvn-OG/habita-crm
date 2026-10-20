import type { Session, User } from '@supabase/supabase-js'
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type PropsWithChildren } from 'react'
import { getErrorMessage } from '@/lib/errors'
import { markSessionExpired, onSessionExpired } from '@/lib/session'
import { getSupabase } from '@/lib/supabase'
import type { Profile } from '@/types/domain'

type ProfileState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'ready'; profile: Profile }
  | { status: 'missing' }
  | { status: 'error'; message: string }

export type Permissions = {
  isAdmin: boolean
  isManager: boolean
  /** Exclusão de registros principais (imóveis, contatos, leads). */
  canDelete: boolean
  /** Gestão de equipe e configuração dos funis. */
  canManageSettings: boolean
  canEditLead: (lead: { assigned_to: string | null; created_by: string | null }) => boolean
}

type AuthValue = {
  initializing: boolean
  session: Session | null
  user: User | null
  profileState: ProfileState
  profile: Profile | null
  permissions: Permissions
  /** true quando a sessão atual veio de um link de recuperação de senha. */
  recoveryMode: boolean
  signIn: (email: string, password: string) => Promise<string | null>
  signOut: () => Promise<void>
  requestPasswordReset: (email: string) => Promise<string | null>
  updatePassword: (password: string) => Promise<string | null>
  refreshProfile: () => Promise<void>
  clearRecoveryMode: () => void
}

const AuthContext = createContext<AuthValue | null>(null)

// "*" mantém o login funcionando mesmo antes de novas colunas (ex.: preferences) existirem no banco.
const PROFILE_COLUMNS = '*'

function translateAuthError(message: string) {
  if (/invalid login credentials/i.test(message)) return 'E-mail ou senha inválidos.'
  if (/email not confirmed/i.test(message)) return 'Confirme seu e-mail antes de entrar. Verifique sua caixa de entrada.'
  if (/rate limit|too many/i.test(message)) return 'Muitas tentativas em sequência. Aguarde alguns minutos e tente novamente.'
  if (/same.*password|different from the old/i.test(message)) return 'A nova senha deve ser diferente da senha atual.'
  if (/password should be at least|weak/i.test(message)) return 'A senha não atende aos requisitos mínimos de segurança.'
  if (/failed to fetch|network/i.test(message)) return 'Falha de conexão. Verifique sua internet e tente novamente.'
  if (/error sending .*email|http 50[24]|timed? ?out/i.test(message)) return 'Não foi possível enviar o e-mail agora. Tente novamente mais tarde ou fale com o administrador.'
  if (/auth session missing|session.*expired|invalid.*(token|otp)|otp.*expired/i.test(message)) {
    return 'O link expirou ou já foi utilizado. Solicite uma nova redefinição de senha.'
  }
  return message
}

export function AuthProvider({ children }: PropsWithChildren) {
  const supabase = getSupabase()
  const [initializing, setInitializing] = useState(true)
  const [session, setSession] = useState<Session | null>(null)
  const [profileResult, setProfileResult] = useState<{ userId: string; state: ProfileState } | null>(null)
  const [recoveryMode, setRecoveryMode] = useState(false)
  const manualSignOut = useRef(false)
  const userId = session?.user.id ?? null

  useEffect(() => {
    let active = true

    void supabase.auth.getSession().then(({ data }) => {
      if (!active) return
      setSession(data.session)
      setInitializing(false)
    })

    // Não chamar o Supabase diretamente dentro deste callback (recomendação da biblioteca).
    const { data: listener } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (!active) return
      if (event === 'PASSWORD_RECOVERY') setRecoveryMode(true)
      if (event === 'SIGNED_OUT') {
        if (!manualSignOut.current) markSessionExpired()
        manualSignOut.current = false
        setRecoveryMode(false)
      }
      setSession(nextSession)
      setInitializing(false)
    })

    return () => {
      active = false
      listener.subscription.unsubscribe()
    }
  }, [supabase])

  // Sessão rejeitada pelo servidor durante uma consulta: encerra localmente.
  useEffect(
    () =>
      onSessionExpired(() => {
        markSessionExpired()
        void supabase.auth.signOut({ scope: 'local' })
      }),
    [supabase],
  )

  const loadProfile = useCallback(
    async (id: string): Promise<ProfileState> => {
      const { data, error } = await supabase.from('profiles').select(PROFILE_COLUMNS).eq('id', id).maybeSingle()
      if (error) return { status: 'error', message: getErrorMessage(error) }
      return data ? { status: 'ready', profile: data as Profile } : { status: 'missing' }
    },
    [supabase],
  )

  useEffect(() => {
    if (!userId) return
    let active = true
    void loadProfile(userId).then((state) => {
      if (active) setProfileResult({ userId, state })
    })
    return () => {
      active = false
    }
  }, [userId, loadProfile])

  // O perfil carregado só vale para o usuário atual; enquanto não chega, está "carregando".
  const profileState = useMemo<ProfileState>(() => {
    if (!userId) return { status: 'idle' }
    return profileResult?.userId === userId ? profileResult.state : { status: 'loading' }
  }, [userId, profileResult])

  const profile = profileState.status === 'ready' ? profileState.profile : null

  const permissions = useMemo<Permissions>(() => {
    const active = Boolean(profile?.is_active)
    const isAdmin = active && profile?.role === 'admin'
    const isManager = active && (profile?.role === 'admin' || profile?.role === 'gestor')
    return {
      isAdmin,
      isManager,
      canDelete: isManager,
      canManageSettings: isAdmin,
      canEditLead: (lead) =>
        isManager ||
        (active && (lead.assigned_to === null || lead.assigned_to === profile?.id || lead.created_by === profile?.id)),
    }
  }, [profile])

  const value = useMemo<AuthValue>(
    () => ({
      initializing,
      session,
      user: session?.user ?? null,
      profileState,
      profile,
      permissions,
      recoveryMode,
      signIn: async (email, password) => {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        return error ? translateAuthError(error.message) : null
      },
      signOut: async () => {
        manualSignOut.current = true
        const { error } = await supabase.auth.signOut()
        if (error) {
          // Mesmo com falha de rede, encerra a sessão neste navegador.
          await supabase.auth.signOut({ scope: 'local' })
        }
      },
      requestPasswordReset: async (email) => {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/redefinir-senha`,
        })
        return error ? translateAuthError(error.message) : null
      },
      updatePassword: async (password) => {
        // Ao definir a própria senha, a marca de "senha provisória" é removida.
        const { error } = await supabase.auth.updateUser({ password, data: { must_change_password: false } })
        return error ? translateAuthError(error.message) : null
      },
      refreshProfile: async () => {
        if (userId) setProfileResult({ userId, state: await loadProfile(userId) })
      },
      clearRecoveryMode: () => setRecoveryMode(false),
    }),
    [initializing, session, profileState, profile, permissions, recoveryMode, supabase, userId, loadProfile],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const value = useContext(AuthContext)
  if (!value) throw new Error('useAuth deve ser usado dentro de AuthProvider.')
  return value
}

export { translateAuthError }
