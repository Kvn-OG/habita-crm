import { zodResolver } from '@hookform/resolvers/zod'
import { useQueryClient } from '@tanstack/react-query'
import { Check, Copy, KeyRound, RefreshCw, UserPlus } from 'lucide-react'
import { useState } from 'react'
import { Controller, useForm, useWatch } from 'react-hook-form'
import { Alert } from '@/components/feedback/Alert'
import { useToast } from '@/components/feedback/Toast'
import { Field, RequiredNote } from '@/components/forms/Field'
import { Input, SelectField, TextField } from '@/components/forms/inputs'
import { Button, IconButton } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { SegmentedControl } from '@/components/ui/SegmentedControl'
import { teamMembersKey } from '@/hooks/useTeamMembers'
import { getErrorMessage } from '@/lib/errors'
import { roleLabels, toOptions } from '@/lib/labels'
import { requiredText, z } from '@/lib/validations'
import { APP_ROLES, type Profile } from '@/types/domain'
import { createAccess, generateTemporaryPassword, resetMemberPassword } from '../accessApi'
import { settingsKeys } from '../api'

const temporaryPassword = z
  .string()
  .min(8, 'A senha deve ter pelo menos 8 caracteres.')
  .max(72, 'A senha deve ter no máximo 72 caracteres.')
  .regex(/[A-Za-z]/, 'Inclua pelo menos uma letra.')
  .regex(/\d/, 'Inclua pelo menos um número.')

const accessSchema = z
  .object({
    full_name: requiredText('o nome completo', 2, 120),
    email: z.string().trim().min(1, 'Informe o e-mail.').pipe(z.email('Informe um e-mail válido.')),
    role: z.enum(APP_ROLES),
    mode: z.enum(['password', 'invite']),
    password: z.string(),
  })
  .superRefine((values, ctx) => {
    if (values.mode !== 'password') return
    const result = temporaryPassword.safeParse(values.password)
    if (!result.success) ctx.addIssue({ code: 'custom', path: ['password'], message: result.error.issues[0]?.message ?? 'Senha inválida.' })
  })
type AccessValues = z.infer<typeof accessSchema>

/** Dados para repassar à pessoa (WhatsApp, por exemplo), com botão de copiar. */
function CredentialsSummary({ email, password }: { email: string; password?: string }) {
  const toast = useToast()
  const [copied, setCopied] = useState(false)
  const text = [
    `Acesso ao Habita — CRM da imobiliária`,
    `Endereço: ${window.location.origin}`,
    `E-mail: ${email}`,
    password ? `Senha provisória: ${password}` : 'Verifique seu e-mail para criar a senha.',
    password ? 'No primeiro acesso, troque a senha em Configurações → Meu perfil.' : '',
  ]
    .filter(Boolean)
    .join('\n')

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      toast.success('Dados de acesso copiados.')
    } catch {
      toast.error('Não foi possível copiar. Selecione o texto e copie manualmente.')
    }
  }

  return (
    <div className="space-y-3">
      <pre className="overflow-x-auto rounded-md border border-line bg-canvas px-3.5 py-3 font-sans text-[13px] leading-relaxed whitespace-pre-wrap text-ink">{text}</pre>
      <Button variant="secondary" icon={copied ? <Check /> : <Copy />} onClick={() => void copy()}>
        {copied ? 'Copiado' : 'Copiar dados de acesso'}
      </Button>
      {password && (
        <p className="text-xs text-muted">Por segurança, esta senha não será exibida novamente. Envie por um canal privado.</p>
      )}
    </div>
  )
}

function PasswordInput({ value, onChange, error, ...fieldProps }: { value: string; onChange: (value: string) => void; error?: boolean } & Record<string, unknown>) {
  return (
    <div className="flex gap-2">
      <Input {...fieldProps} value={value} onChange={(event) => onChange(event.target.value)} autoComplete="off" spellCheck={false} className="font-mono" aria-invalid={error ? true : undefined} />
      <IconButton label="Gerar nova senha" variant="secondary" size="icon" onClick={() => onChange(generateTemporaryPassword())}>
        <RefreshCw />
      </IconButton>
    </div>
  )
}

export function CreateAccessModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  if (!open) return null
  return <CreateAccessContent onClose={onClose} />
}

function CreateAccessContent({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient()
  const toast = useToast()
  const [created, setCreated] = useState<{ email: string; password?: string } | null>(null)
  const { register, control, handleSubmit, formState } = useForm<AccessValues>({
    resolver: zodResolver(accessSchema),
    defaultValues: { full_name: '', email: '', role: 'corretor', mode: 'password', password: generateTemporaryPassword() },
  })
  const mode = useWatch({ control, name: 'mode' })
  const { errors, isSubmitting } = formState

  const onSubmit = handleSubmit(async (values) => {
    try {
      await createAccess({
        email: values.email,
        full_name: values.full_name,
        role: values.role,
        mode: values.mode,
        password: values.mode === 'password' ? values.password : undefined,
      })
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: settingsKeys.profiles }),
        queryClient.invalidateQueries({ queryKey: teamMembersKey }),
      ])
      toast.success('Acesso criado.', values.full_name)
      setCreated({ email: values.email.trim().toLowerCase(), password: values.mode === 'password' ? values.password : undefined })
    } catch (error) {
      toast.error('Não foi possível criar o acesso', getErrorMessage(error))
    }
  })

  if (created) {
    return (
      <Modal
        open
        onClose={onClose}
        title="Acesso criado"
        description={created.password ? 'Envie os dados abaixo para a pessoa.' : 'O convite foi enviado por e-mail.'}
        footer={<Button onClick={onClose}>Concluir</Button>}
      >
        <CredentialsSummary email={created.email} password={created.password} />
      </Modal>
    )
  }

  return (
    <Modal
      open
      onClose={onClose}
      dismissible={!isSubmitting}
      title="Novo acesso"
      description="A pessoa entra no Habita com o papel escolhido, já liberada."
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={isSubmitting}>
            Cancelar
          </Button>
          <Button type="submit" form="access-form" icon={<UserPlus />} loading={isSubmitting}>
            Criar acesso
          </Button>
        </>
      }
    >
      <form id="access-form" className="space-y-4" noValidate onSubmit={(event) => void onSubmit(event)}>
        <TextField label="Nome completo" required autoFocus error={errors.full_name?.message} {...register('full_name')} />
        <div className="grid gap-4 sm:grid-cols-[1fr_180px]">
          <TextField label="E-mail" type="email" required autoComplete="off" error={errors.email?.message} {...register('email')} />
          <SelectField label="Papel" required options={toOptions(roleLabels, APP_ROLES)} {...register('role')} />
        </div>
        <Field label="Forma de acesso" required>
          {() => (
            <Controller
              control={control}
              name="mode"
              render={({ field }) => (
                <SegmentedControl
                  label="Forma de acesso"
                  value={field.value}
                  onChange={field.onChange}
                  className="w-full [&>button]:flex-1 [&>button]:justify-center"
                  options={[
                    { value: 'password', label: 'Senha provisória' },
                    { value: 'invite', label: 'Convite por e-mail' },
                  ]}
                />
              )}
            />
          )}
        </Field>
        {mode === 'password' ? (
          <Field label="Senha provisória" required error={errors.password?.message} hint="Gerada automaticamente. A pessoa deve trocá-la no primeiro acesso.">
            {(fieldProps) => (
              <Controller
                control={control}
                name="password"
                render={({ field }) => <PasswordInput {...fieldProps} value={field.value} onChange={field.onChange} error={Boolean(errors.password)} />}
              />
            )}
          </Field>
        ) : (
          <Alert tone="info">
            A pessoa recebe um e-mail para criar a própria senha. O Supabase gratuito envia poucos e-mails por hora; se o limite for atingido, use a senha provisória.
          </Alert>
        )}
        <RequiredNote />
      </form>
    </Modal>
  )
}

export function ResetPasswordModal({ member, onClose }: { member: Profile | null; onClose: () => void }) {
  if (!member) return null
  return <ResetPasswordContent member={member} onClose={onClose} />
}

function ResetPasswordContent({ member, onClose }: { member: Profile; onClose: () => void }) {
  const toast = useToast()
  const [password, setPassword] = useState(generateTemporaryPassword)
  const [saving, setSaving] = useState(false)
  const [done, setDone] = useState(false)
  const validation = temporaryPassword.safeParse(password)
  const name = member.full_name.trim() || member.email

  const submit = async () => {
    if (!validation.success) return
    setSaving(true)
    try {
      await resetMemberPassword(member.id, password)
      toast.success('Senha redefinida.', name)
      setDone(true)
    } catch (error) {
      toast.error('Não foi possível redefinir a senha', getErrorMessage(error))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      dismissible={!saving}
      title={done ? 'Senha redefinida' : 'Redefinir senha'}
      description={done ? 'Envie a nova senha provisória para a pessoa.' : `Defina uma senha provisória para ${name}. A senha atual deixa de funcionar.`}
      footer={
        done ? (
          <Button onClick={onClose}>Concluir</Button>
        ) : (
          <>
            <Button variant="secondary" onClick={onClose} disabled={saving}>
              Cancelar
            </Button>
            <Button icon={<KeyRound />} loading={saving} disabled={!validation.success} onClick={() => void submit()}>
              Redefinir senha
            </Button>
          </>
        )
      }
    >
      {done ? (
        <CredentialsSummary email={member.email} password={password} />
      ) : (
        <Field label="Nova senha provisória" required error={validation.success ? undefined : validation.error.issues[0]?.message}>
          {(fieldProps) => <PasswordInput {...fieldProps} value={password} onChange={setPassword} error={!validation.success} />}
        </Field>
      )}
    </Modal>
  )
}
