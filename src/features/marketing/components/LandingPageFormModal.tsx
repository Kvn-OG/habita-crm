import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { useToast } from '@/components/feedback/Toast'
import { RequiredNote } from '@/components/forms/Field'
import { Checkbox, SelectField, TextareaField, TextField } from '@/components/forms/inputs'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { memberName, useTeamMembers } from '@/hooks/useTeamMembers'
import { getErrorMessage } from '@/lib/errors'
import { pipelineLabels, toOptions } from '@/lib/labels'
import { marketingKeys, saveLandingPage } from '../api'
import { emptyLandingPageValues, landingPageSchema, landingPageToFormValues, type LandingPageFormValues } from '../schema'
import type { LandingPage } from '../types'

type LandingPageFormModalProps = {
  open: boolean
  onClose: () => void
  page?: LandingPage | null
}

export function LandingPageFormModal(props: LandingPageFormModalProps) {
  if (!props.open) return null
  return <LandingPageFormModalContent {...props} />
}

function LandingPageFormModalContent({ onClose, page }: LandingPageFormModalProps) {
  const queryClient = useQueryClient()
  const toast = useToast()
  const teamQuery = useTeamMembers()
  const editing = Boolean(page)

  const { register, handleSubmit, formState: { errors } } = useForm<LandingPageFormValues>({
    resolver: zodResolver(landingPageSchema),
    defaultValues: page ? landingPageToFormValues(page) : emptyLandingPageValues,
  })

  const save = useMutation({
    mutationFn: (values: LandingPageFormValues) => saveLandingPage(values, page?.id),
    onSuccess: async (_data, values) => {
      await queryClient.invalidateQueries({ queryKey: marketingKeys.all })
      toast.success(editing ? 'Landing page atualizada.' : 'Landing page cadastrada.', values.name)
      onClose()
    },
    onError: (error) => toast.error('Não foi possível salvar a landing page', getErrorMessage(error)),
  })

  const members = (teamQuery.data ?? []).map((member) => ({ value: member.id, label: memberName(member) }))

  return (
    <Modal
      open
      onClose={onClose}
      dismissible={!save.isPending}
      title={editing ? 'Editar landing page' : 'Nova landing page'}
      description={editing ? page?.name : 'Vincule uma página criada fora do CRM para receber os leads dela direto no funil.'}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={save.isPending}>
            Cancelar
          </Button>
          <Button type="submit" form="landing-page-form" loading={save.isPending}>
            {editing ? 'Salvar alterações' : 'Cadastrar landing page'}
          </Button>
        </>
      }
    >
      <form
        id="landing-page-form"
        className="space-y-4"
        noValidate
        onSubmit={(event) => {
          event.stopPropagation()
          void handleSubmit((values) => save.mutate(values))(event)
        }}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField label="Nome" required autoFocus placeholder="Minha Casa, Minha Vida" error={errors.name?.message} {...register('name')} />
          <SelectField label="Funil dos leads" required options={toOptions(pipelineLabels)} hint="Etapa inicial do funil escolhido." error={errors.pipeline?.message} {...register('pipeline')} />
        </div>
        <TextField
          label="Propósito"
          required
          placeholder="Imóveis do programa Minha Casa, Minha Vida"
          hint="Para que serve a página: lançamentos, imóveis usados, alto padrão, locação…"
          error={errors.purpose?.message}
          {...register('purpose')}
        />
        <TextField label="Endereço da página" type="url" placeholder="https://" error={errors.url?.message} {...register('url')} />
        <SelectField
          label="Corretor responsável pelos leads"
          placeholder="Sem responsável (o administrador distribui)"
          options={members}
          disabled={teamQuery.isLoading}
          error={errors.default_assignee?.message}
          {...register('default_assignee')}
        />
        <TextareaField label="Observações" rows={2} error={errors.notes?.message} {...register('notes')} />
        <Checkbox label="Recebendo leads" description="Desmarque para pausar: a página deixa de enviar leads ao CRM." {...register('is_active')} />
        <RequiredNote />
      </form>
    </Modal>
  )
}
