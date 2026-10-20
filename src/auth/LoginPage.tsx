import { zodResolver } from '@hookform/resolvers/zod'
import { LogIn } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { useLocation, useNavigate } from 'react-router-dom'
import { Alert } from '@/components/feedback/Alert'
import { TextField } from '@/components/forms/inputs'
import { Button } from '@/components/ui/Button'
import { consumeSessionExpiredFlag } from '@/lib/session'
import { z } from '@/lib/validations'
import { useAuth } from './AuthContext'
import { AuthLayout } from './AuthLayout'

const schema = z.object({
  email: z.string().trim().min(1, 'Informe seu e-mail.').pipe(z.email('Informe um e-mail válido.')),
  password: z.string().min(1, 'Informe sua senha.'),
})
type Values = z.infer<typeof schema>

export function LoginPage() {
  const { signIn } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [error, setError] = useState<string | null>(null)
  const [sessionExpired] = useState(() => consumeSessionExpiredFlag())
  const from = (location.state as { from?: string } | null)?.from ?? '/'
  const passwordUpdated = (location.state as { passwordUpdated?: boolean } | null)?.passwordUpdated

  const { register, handleSubmit, formState } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { email: '', password: '' },
  })

  const onSubmit = handleSubmit(async (values) => {
    setError(null)
    const message = await signIn(values.email, values.password)
    if (message) {
      setError(message)
      return
    }
    navigate(from, { replace: true })
  })

  return (
    <AuthLayout>
      <h2 className="text-xl font-semibold tracking-tight text-ink">Entrar</h2>
      <p className="mt-1 text-[13px] text-muted">Use o e-mail e a senha cadastrados pela administração.</p>

      <div className="mt-5 space-y-3 empty:hidden">
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
          {/* Sem SMTP próprio o Supabase não envia e-mails aos usuários: a senha é redefinida pelo administrador (Configurações → Equipe). */}
          <p className="mt-2 text-right text-xs text-muted">Esqueceu a senha? Fale com o administrador da imobiliária.</p>
        </div>
        <Button type="submit" className="w-full" loading={formState.isSubmitting} icon={<LogIn />}>
          Entrar
        </Button>
      </form>
    </AuthLayout>
  )
}
