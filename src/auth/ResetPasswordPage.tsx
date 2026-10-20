import { zodResolver } from '@hookform/resolvers/zod'
import { KeyRound } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Alert } from '@/components/feedback/Alert'
import { TextField } from '@/components/forms/inputs'
import { Button } from '@/components/ui/Button'
import { LoadingScreen } from '@/components/ui/Feedback'
import { getSupabase } from '@/lib/supabase'
import { z } from '@/lib/validations'
import { translateAuthError, useAuth } from './AuthContext'
import { AuthLayout } from './AuthLayout'

export const passwordSchema = z
  .object({
    password: z
      .string()
      .min(8, 'A senha deve ter pelo menos 8 caracteres.')
      .max(72, 'A senha deve ter no máximo 72 caracteres.')
      .regex(/[A-Za-z]/, 'Inclua pelo menos uma letra.')
      .regex(/\d/, 'Inclua pelo menos um número.'),
    confirmation: z.string(),
  })
  .refine((values) => values.password === values.confirmation, {
    path: ['confirmation'],
    message: 'As senhas não conferem.',
  })
export type PasswordValues = z.infer<typeof passwordSchema>

/**
 * Aceita dois formatos de link:
 *  - padrão do Supabase (PKCE ?code=...), tratado automaticamente pelo cliente;
 *  - template personalizado com ?token_hash=...&type=recovery (funciona em outro dispositivo).
 */
export function ResetPasswordPage() {
  const { session, initializing, updatePassword, signOut, clearRecoveryMode } = useAuth()
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const tokenHash = params.get('token_hash')
  const linkError = params.get('error_description')
  const [verifying, setVerifying] = useState(Boolean(tokenHash))
  const [error, setError] = useState<string | null>(linkError ? translateAuthError(linkError) : null)
  const verified = useRef(false)

  useEffect(() => {
    if (!tokenHash || verified.current) return
    verified.current = true
    void getSupabase()
      .auth.verifyOtp({ token_hash: tokenHash, type: 'recovery' })
      .then(({ error: otpError }) => {
        if (otpError) setError(translateAuthError(otpError.message))
        setVerifying(false)
      })
  }, [tokenHash])

  const { register, handleSubmit, formState } = useForm<PasswordValues>({
    resolver: zodResolver(passwordSchema),
    defaultValues: { password: '', confirmation: '' },
  })

  const onSubmit = handleSubmit(async ({ password }) => {
    setError(null)
    const message = await updatePassword(password)
    if (message) {
      setError(message)
      return
    }
    clearRecoveryMode()
    await signOut()
    navigate('/entrar', { replace: true, state: { passwordUpdated: true } })
  })

  if (initializing || verifying) return <LoadingScreen label="Validando link" />

  return (
    <AuthLayout>
      <h2 className="text-xl font-semibold tracking-tight text-ink">Definir nova senha</h2>
      <p className="mt-1 text-[13px] text-muted">Use pelo menos 8 caracteres, com letras e números.</p>

      {!session ? (
        <div className="mt-5 space-y-4">
          <Alert tone="danger" title="Link inválido ou expirado">
            {error ?? 'Abra o link mais recente enviado para seu e-mail ou solicite uma nova redefinição.'}
          </Alert>
          <Link to="/recuperar-senha" className="block text-center text-[13px] font-medium text-brand-800 hover:underline">
            Solicitar novo link
          </Link>
        </div>
      ) : (
        <form className="mt-5 space-y-4" onSubmit={(event) => void onSubmit(event)} noValidate>
          {error && <Alert tone="danger">{error}</Alert>}
          <TextField
            label="Nova senha"
            type="password"
            autoComplete="new-password"
            autoFocus
            required
            error={formState.errors.password?.message}
            {...register('password')}
          />
          <TextField
            label="Confirme a nova senha"
            type="password"
            autoComplete="new-password"
            required
            error={formState.errors.confirmation?.message}
            {...register('confirmation')}
          />
          <Button type="submit" className="w-full" loading={formState.isSubmitting} icon={<KeyRound />}>
            Salvar nova senha
          </Button>
        </form>
      )}
    </AuthLayout>
  )
}
