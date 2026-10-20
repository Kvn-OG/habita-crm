import { zodResolver } from '@hookform/resolvers/zod'
import { ArrowLeft, Send } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link } from 'react-router-dom'
import { Alert } from '@/components/feedback/Alert'
import { TextField } from '@/components/forms/inputs'
import { Button } from '@/components/ui/Button'
import { z } from '@/lib/validations'
import { useAuth } from './AuthContext'
import { AuthLayout } from './AuthLayout'

const schema = z.object({
  email: z.string().trim().min(1, 'Informe seu e-mail.').pipe(z.email('Informe um e-mail válido.')),
})
type Values = z.infer<typeof schema>

export function ForgotPasswordPage() {
  const { requestPasswordReset } = useAuth()
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { register, handleSubmit, formState } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { email: '' },
  })

  const onSubmit = handleSubmit(async ({ email }) => {
    setError(null)
    const message = await requestPasswordReset(email)
    if (message) setError(message)
    else setSent(true)
  })

  return (
    <AuthLayout>
      <Link to="/entrar" className="inline-flex items-center gap-1.5 text-xs font-medium text-muted hover:text-ink">
        <ArrowLeft className="size-3.5" aria-hidden="true" /> Voltar para o login
      </Link>
      <h2 className="mt-4 text-xl font-semibold tracking-tight text-ink">Recuperar senha</h2>
      <p className="mt-1 text-[13px] text-muted">Enviaremos um link para você definir uma nova senha.</p>

      {sent ? (
        <Alert tone="success" title="Verifique seu e-mail" className="mt-5">
          Se o endereço estiver cadastrado, você receberá em instantes um link para redefinir a senha. O link é válido por tempo limitado.
        </Alert>
      ) : (
        <form className="mt-5 space-y-4" onSubmit={(event) => void onSubmit(event)} noValidate>
          {error && <Alert tone="danger">{error}</Alert>}
          <TextField
            label="E-mail"
            type="email"
            autoComplete="email"
            autoFocus
            error={formState.errors.email?.message}
            {...register('email')}
          />
          <Button type="submit" className="w-full" loading={formState.isSubmitting} icon={<Send />}>
            Enviar link de redefinição
          </Button>
        </form>
      )}
    </AuthLayout>
  )
}
