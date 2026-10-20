import { zodResolver } from '@hookform/resolvers/zod'
import { LogIn } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { Alert } from '@/components/feedback/Alert'
import { TextField } from '@/components/forms/inputs'
import { Button } from '@/components/ui/Button'
import { consumeSessionExpiredFlag, consumeSessionReplacedFlag } from '@/lib/session'
import { z } from '@/lib/validations'
import { useAuth, type OtherSession } from './AuthContext'
import { AuthLayout } from './AuthLayout'
import { SessionConflictModal } from './SessionConflictModal'

const schema = z.object({
  email: z.string().trim().min(1, 'Informe seu e-mail.').pipe(z.email('Informe um e-mail válido.')),
  password: z.string().min(1, 'Informe sua senha.'),
})
type Values = z.infer<typeof schema>

export function LoginPage() {
  const { signIn, resolveSessionConflict } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [error, setError] = useState<string | null>(null)
  const [sessionReplaced] = useState(() => consumeSessionReplacedFlag())
  const [sessionExpired] = useState(() => consumeSessionExpiredFlag() && !sessionReplaced)
  const [conflict, setConflict] = useState<OtherSession[] | null>(null)
  const [loginCancelled, setLoginCancelled] = useState(false)
  const from = (location.state as { from?: string } | null)?.from ?? '/'
  const passwordUpdated = (location.state as { passwordUpdated?: boolean } | null)?.passwordUpdated

  const { register, handleSubmit, formState } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { email: '', password: '' },
  })

  const onSubmit = handleSubmit(async (values) => {
    setError(null)
    setLoginCancelled(false)
    const result = await signIn(values.email, values.password)
    if (result.error) {
      setError(result.error)
      return
    }
    if (result.conflict.length > 0) {
      setConflict(result.conflict)
      return
    }
    navigate(from, { replace: true })
  })

  const resolveConflict = async (choice: 'end-others' | 'cancel') => {
    const message = await resolveSessionConflict(choice)
    if (message) return message
    setConflict(null)
    if (choice === 'end-others') navigate(from, { replace: true })
    else setLoginCancelled(true)
    return null
  }

  return (
    <AuthLayout>
      <h2 className="text-xl font-semibold tracking-tight text-ink">Entrar</h2>
      <p className="mt-1 text-[13px] text-muted">Use o e-mail e a senha cadastrados pela administração.</p>

      <div className="mt-5 space-y-3 empty:hidden">
        {sessionReplaced && !error && (
          <Alert tone="warning" title="Sua sessão foi encerrada">
            Sua conta foi acessada em outro dispositivo. Entre novamente para continuar por aqui.
          </Alert>
        )}
        {loginCancelled && !error && <Alert tone="info">Login cancelado. A sessão no outro dispositivo continua aberta.</Alert>}
        {sessionExpired && !error && (
          <Alert tone="warning" title="Sua sessão expirou">
            Por segurança, entre novamente para continuar.
          </Alert>
        )}
        {passwordUpdated && <Alert tone="success">Senha atualizada. Entre com a nova senha.</Alert>}
        {error && <Alert tone="danger">{error}</Alert>}
      </div>

      <form className="mt-5 space-y-4" onSubmit={(event) => void onSubmit(event)} noValidate>
        <TextField
          label="E-mail"
          type="email"
          autoComplete="username"
          autoFocus
          placeholder="nome@exemplo.com"
          error={formState.errors.email?.message}
          {...register('email')}
        />
        <div>
          <TextField
            label="Senha"
            type="password"
            autoComplete="current-password"
            error={formState.errors.password?.message}
            {...register('password')}
          />
          <div className="mt-2 text-right">
            <Link to="/recuperar-senha" className="text-xs font-medium text-brand-800 underline-offset-2 hover:underline">
              Esqueci minha senha
            </Link>
          </div>
        </div>
        <Button type="submit" className="w-full" loading={formState.isSubmitting} icon={<LogIn />}>
          Entrar
        </Button>
      </form>
      {conflict && <SessionConflictModal sessions={conflict} onResolve={resolveConflict} />}
    </AuthLayout>
  )
}
