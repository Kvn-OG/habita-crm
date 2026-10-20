import { zodResolver } from '@hookform/resolvers/zod'
import { useQueryClient } from '@tanstack/react-query'
import { KeyRound, Save } from 'lucide-react'
import { Controller, useForm } from 'react-hook-form'
import { useAuth } from '@/auth/AuthContext'
import { passwordSchema, type PasswordValues } from '@/auth/ResetPasswordPage'
import { useToast } from '@/components/feedback/Toast'
import { PhoneField, TextField } from '@/components/forms/inputs'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card, CardBody, CardHeader } from '@/components/ui/Card'
import { teamMembersKey } from '@/hooks/useTeamMembers'
import { getErrorMessage } from '@/lib/errors'
import { roleLabels } from '@/lib/labels'
import { phone, requiredText, z } from '@/lib/validations'
import { updateOwnProfile } from '../api'

const profileSchema = z.object({ full_name: requiredText('o nome', 2, 120), phone: phone(false) })
type ProfileValues = z.infer<typeof profileSchema>

export function ProfileSettings() {
  const { profile, user, refreshProfile, updatePassword } = useAuth()
  const toast = useToast()
  const queryClient = useQueryClient()

  const profileForm = useForm<ProfileValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: { full_name: profile?.full_name ?? '', phone: profile?.phone ?? '' },
  })
  const passwordForm = useForm<PasswordValues>({
    resolver: zodResolver(passwordSchema),
    defaultValues: { password: '', confirmation: '' },
  })

  if (!profile) return null

  const saveProfile = profileForm.handleSubmit(async (values) => {
    try {
      await updateOwnProfile(profile.id, values)
      await refreshProfile()
      await queryClient.invalidateQueries({ queryKey: teamMembersKey })
      toast.success('Perfil atualizado.')
    } catch (error) {
      toast.error('Não foi possível atualizar o perfil', getErrorMessage(error))
    }
  })

  const savePassword = passwordForm.handleSubmit(async ({ password }) => {
    const message = await updatePassword(password)
    if (message) {
      toast.error('Não foi possível alterar a senha', message)
      return
    }
    passwordForm.reset()
    toast.success('Senha alterada com sucesso.')
  })

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <Card>
        <CardHeader title="Meus dados" description="Exibidos para a equipe como responsável por leads e compromissos." />
        <CardBody>
          <form className="space-y-4" onSubmit={(event) => void saveProfile(event)} noValidate>
            <TextField label="Nome completo" required error={profileForm.formState.errors.full_name?.message} {...profileForm.register('full_name')} />
            <Controller
              control={profileForm.control}
              name="phone"
              render={({ field }) => (
                <PhoneField label="Telefone" error={profileForm.formState.errors.phone?.message} value={field.value} onChange={field.onChange} onBlur={field.onBlur} name={field.name} ref={field.ref} />
              )}
            />
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-md bg-canvas px-3 py-2.5 text-xs text-muted">
              <span>
                E-mail: <strong className="font-medium text-ink">{user?.email}</strong>
              </span>
              <span className="flex items-center gap-1.5">
                Papel: <Badge tone="accent">{roleLabels[profile.role]}</Badge>
              </span>
            </div>
            <Button type="submit" icon={<Save />} loading={profileForm.formState.isSubmitting}>
              Salvar dados
            </Button>
          </form>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Alterar senha" description="Mínimo de 8 caracteres, com letras e números." />
        <CardBody>
          <form className="space-y-4" onSubmit={(event) => void savePassword(event)} noValidate>
            <TextField label="Nova senha" type="password" autoComplete="new-password" required error={passwordForm.formState.errors.password?.message} {...passwordForm.register('password')} />
            <TextField label="Confirme a nova senha" type="password" autoComplete="new-password" required error={passwordForm.formState.errors.confirmation?.message} {...passwordForm.register('confirmation')} />
            <Button type="submit" variant="secondary" icon={<KeyRound />} loading={passwordForm.formState.isSubmitting}>
              Alterar senha
            </Button>
          </form>
        </CardBody>
      </Card>
    </div>
  )
}
