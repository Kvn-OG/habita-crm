import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { useToast } from '@/components/feedback/Toast'
import { RequiredNote } from '@/components/forms/Field'
import { CurrencyField, integerRegisterOptions, SelectField, TextareaField, TextField } from '@/components/forms/inputs'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { getErrorMessage } from '@/lib/errors'
import { toOptions } from '@/lib/labels'
import { listLandingPages, marketingKeys, saveCampaign } from '../api'
import { campaignObjectiveLabels, campaignPlatformLabels, campaignStatusLabels } from '../labels'
import { campaignSchema, campaignToFormValues, emptyCampaignValues, suggestUtm, type CampaignFormValues } from '../schema'
import type { Campaign } from '../types'

type CampaignFormModalProps = {
  open: boolean
  onClose: () => void
  campaign?: Campaign | null
}

/** Seção do formulário em duas colunas (o FormSection da página é largo demais para o modal). */
function Section({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return (
    <section className="border-b border-line pb-5 last:border-b-0">
      <h3 className="text-sm font-semibold text-ink">{title}</h3>
      {description && <p className="mt-0.5 text-xs text-muted">{description}</p>}
      <div className="mt-3 grid gap-4 sm:grid-cols-2">{children}</div>
    </section>
  )
}

export function CampaignFormModal(props: CampaignFormModalProps) {
  if (!props.open) return null
  return <CampaignFormModalContent {...props} />
}

function CampaignFormModalContent({ onClose, campaign }: CampaignFormModalProps) {
  const queryClient = useQueryClient()
  const toast = useToast()
  const editing = Boolean(campaign)
  const pagesQuery = useQuery({ queryKey: marketingKeys.landingPages, queryFn: listLandingPages })

  const { register, control, handleSubmit, getValues, setValue, formState: { errors } } = useForm<CampaignFormValues>({
    resolver: zodResolver(campaignSchema),
    defaultValues: campaign ? campaignToFormValues(campaign) : emptyCampaignValues,
  })

  const save = useMutation({
    mutationFn: (values: CampaignFormValues) => saveCampaign(values, campaign?.id),
    onSuccess: async (_data, values) => {
      await queryClient.invalidateQueries({ queryKey: marketingKeys.all })
      toast.success(editing ? 'Campanha atualizada.' : 'Campanha cadastrada.', values.name)
      onClose()
    },
    onError: (error) => toast.error('Não foi possível salvar a campanha', getErrorMessage(error)),
  })

  const pages = (pagesQuery.data ?? []).map((page) => ({ value: page.id, label: page.name }))
  const nameField = register('name')

  return (
    <Modal
      open
      size="lg"
      onClose={onClose}
      dismissible={!save.isPending}
      title={editing ? 'Editar campanha' : 'Nova campanha'}
      description={editing ? campaign?.name : 'Acompanhe o investimento e os resultados de uma campanha de tráfego pago.'}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={save.isPending}>
            Cancelar
          </Button>
          <Button type="submit" form="campaign-form" loading={save.isPending}>
            {editing ? 'Salvar alterações' : 'Cadastrar campanha'}
          </Button>
        </>
      }
    >
      <form
        id="campaign-form"
        className="space-y-5"
        noValidate
        onSubmit={(event) => {
          event.stopPropagation()
          void handleSubmit((values) => save.mutate(values))(event)
        }}
      >
        <Section title="Campanha">
          <TextField
            label="Nome"
            required
            autoFocus
            placeholder="Lançamento Jardim Primavera — outubro"
            className="sm:col-span-2"
            error={errors.name?.message}
            {...nameField}
            onBlur={(event) => {
              void nameField.onBlur(event)
              // Sugere o identificador UTM no primeiro preenchimento.
              if (!getValues('utm_campaign')) setValue('utm_campaign', suggestUtm(event.target.value))
            }}
          />
          <SelectField label="Situação" required options={toOptions(campaignStatusLabels)} error={errors.status?.message} {...register('status')} />
          <SelectField label="Plataforma" required options={toOptions(campaignPlatformLabels)} error={errors.platform?.message} {...register('platform')} />
          <SelectField label="Objetivo" required options={toOptions(campaignObjectiveLabels)} error={errors.objective?.message} {...register('objective')} />
          <SelectField
            label="Landing page de destino"
            placeholder="Nenhuma"
            options={pages}
            disabled={pagesQuery.isLoading}
            error={errors.landing_page_id?.message}
            {...register('landing_page_id')}
          />
          <TextField
            label="Identificador UTM (utm_campaign)"
            placeholder="lancamento-jardim-primavera"
            className="sm:col-span-2"
            hint="Use o mesmo valor no parâmetro utm_campaign dos links dos anúncios: os leads da landing page são ligados a esta campanha."
            error={errors.utm_campaign?.message}
            {...register('utm_campaign')}
          />
          <TextField label="Início" type="date" error={errors.starts_on?.message} {...register('starts_on')} />
          <TextField label="Término" type="date" error={errors.ends_on?.message} {...register('ends_on')} />
        </Section>

        <Section title="Investimento e resultados" description="Atualize com os números do painel da plataforma de anúncios.">
          <Controller
            control={control}
            name="budget"
            render={({ field }) => (
              <CurrencyField label="Orçamento previsto" error={errors.budget?.message} value={field.value} onChange={field.onChange} onBlur={field.onBlur} name={field.name} ref={field.ref} />
            )}
          />
          <Controller
            control={control}
            name="spent"
            render={({ field }) => (
              <CurrencyField label="Valor investido até agora" error={errors.spent?.message} value={field.value} onChange={field.onChange} onBlur={field.onBlur} name={field.name} ref={field.ref} />
            )}
          />
          <TextField label="Impressões" type="number" min={0} step={1} inputMode="numeric" error={errors.impressions?.message} {...register('impressions', integerRegisterOptions)} />
          <TextField label="Cliques" type="number" min={0} step={1} inputMode="numeric" error={errors.clicks?.message} {...register('clicks', integerRegisterOptions)} />
          <TextareaField label="Observações" rows={2} className="sm:col-span-2" error={errors.notes?.message} {...register('notes')} />
        </Section>
        <RequiredNote />
      </form>
    </Modal>
  )
}
