import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { UserPlus } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Controller, useForm, useWatch } from 'react-hook-form'
import { useAuth } from '@/auth/AuthContext'
import { Alert } from '@/components/feedback/Alert'
import { useToast } from '@/components/feedback/Toast'
import { AsyncPicker, type PickerOption } from '@/components/forms/AsyncPicker'
import { Field, RequiredNote } from '@/components/forms/Field'
import { CurrencyField, Select, SelectField, TextareaField, TextField } from '@/components/forms/inputs'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { SegmentedControl } from '@/components/ui/SegmentedControl'
import { contactToOption, searchContactOptions } from '@/features/contacts/api'
import { ContactFormModal } from '@/features/contacts/components/ContactFormModal'
import { searchPropertyOptions } from '@/features/properties/api'
import { memberName, useTeamMembers } from '@/hooks/useTeamMembers'
import { getErrorMessage } from '@/lib/errors'
import { formatPhone } from '@/lib/format'
import { leadSourceLabels, pipelineLabels, toOptions } from '@/lib/labels'
import type { Pipeline } from '@/types/domain'
import { createLead, leadKeys, updateLead, useStages } from '../api'
import { leadSchema, leadToFormValues, type LeadFormValues } from '../schema'
import type { LeadDetail } from '../types'

type LeadFormModalProps = {
  open: boolean
  onClose: () => void
  lead?: LeadDetail | null
  defaultContact?: PickerOption
  defaultPurpose?: Pipeline
  onSaved?: (id: string) => void
}

export function LeadFormModal(props: LeadFormModalProps) {
  if (!props.open) return null
  return <LeadFormContent {...props} />
}

function LeadFormContent({ onClose, lead, defaultContact, defaultPurpose, onSaved }: LeadFormModalProps) {
  const queryClient = useQueryClient()
  const toast = useToast()
  const { profile } = useAuth()
  const stagesQuery = useStages()
  const teamQuery = useTeamMembers()
  const editing = Boolean(lead)

  const [contact, setContact] = useState<PickerOption[]>(() => {
    if (lead) return [{ id: lead.contact_id, label: lead.contact_name, description: formatPhone(lead.contact_phone) }]
    return defaultContact ? [defaultContact] : []
  })
  const [properties, setProperties] = useState<PickerOption[]>(
    () => lead?.properties.map((property) => ({ id: property.id, label: `${property.code} · ${property.title}` })) ?? [],
  )
  const [newContactOpen, setNewContactOpen] = useState(false)

  const {
    register, control, handleSubmit, setValue, getValues,
    formState: { errors },
  } = useForm<LeadFormValues>({
    resolver: zodResolver(leadSchema),
    defaultValues: lead
      ? leadToFormValues(lead)
      : {
          contact_id: defaultContact?.id ?? '',
          purpose: defaultPurpose ?? 'venda',
          source: 'whatsapp',
          stage_id: '',
          assigned_to: profile?.id ?? '',
          min_budget: null,
          max_budget: null,
          desired_region: '',
          next_follow_up_at: '',
          notes: '',
        },
  })

  const purpose = useWatch({ control, name: 'purpose' })
  const stages = (stagesQuery.data ?? []).filter(
    (stage) => stage.pipeline === purpose && (stage.is_active || stage.id === lead?.stage_id),
  )

  // Ao trocar de funil (ou carregar as etapas), seleciona a primeira etapa válida.
  useEffect(() => {
    if (!stagesQuery.data) return
    const current = getValues('stage_id')
    const valid = stagesQuery.data.some((stage) => stage.id === current && stage.pipeline === purpose)
    if (!valid) {
      const first = stagesQuery.data.find((stage) => stage.pipeline === purpose && stage.is_active)
      setValue('stage_id', first?.id ?? '', { shouldValidate: false })
    }
  }, [purpose, stagesQuery.data, getValues, setValue])

  const save = useMutation({
    mutationFn: (values: LeadFormValues) => {
      const propertyIds = properties.map((property) => property.id)
      return lead ? updateLead(lead.id, values, propertyIds).then(() => lead.id) : createLead(values, propertyIds)
    },
    onSuccess: async (id) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: leadKeys.all }),
        queryClient.invalidateQueries({ queryKey: ['activities'] }),
        queryClient.invalidateQueries({ queryKey: ['dashboard'] }),
      ])
      toast.success(editing ? 'Lead atualizado.' : 'Lead cadastrado.', contact[0]?.label)
      onSaved?.(id)
      onClose()
    },
    onError: (error) => toast.error('Não foi possível salvar o lead', getErrorMessage(error)),
  })

  const onSubmit = handleSubmit((values) => save.mutate(values))

  return (
    <Modal
      open
      size="lg"
      onClose={onClose}
      dismissible={!save.isPending}
      title={editing ? 'Editar lead' : 'Novo lead'}
      description={editing ? lead?.contact_name : 'Registre uma nova oportunidade de venda ou locação.'}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={save.isPending}>
            Cancelar
          </Button>
          <Button type="submit" form="lead-form" loading={save.isPending} disabled={stagesQuery.isLoading}>
            {editing ? 'Salvar alterações' : 'Cadastrar lead'}
          </Button>
        </>
      }
    >
      <form
        id="lead-form"
        className="space-y-5"
        onSubmit={(event) => {
          event.stopPropagation()
          void onSubmit(event)
        }}
        noValidate
      >
        {stagesQuery.isError && <Alert tone="danger">Não foi possível carregar as etapas: {getErrorMessage(stagesQuery.error)}</Alert>}

        <Field label="Contato relacionado" required error={errors.contact_id?.message}>
          {(fieldProps) => (
            <AsyncPicker
              {...fieldProps}
              queryKey="lead-contact"
              search={searchContactOptions}
              selected={contact}
              onChange={(selected) => {
                setContact(selected)
                setValue('contact_id', selected[0]?.id ?? '', { shouldValidate: true })
              }}
              placeholder="Buscar contato por nome ou telefone"
              footer={
                <button type="button" className="inline-flex items-center gap-1.5 font-medium text-brand-800 hover:underline" onClick={() => setNewContactOpen(true)}>
                  <UserPlus className="size-3.5" aria-hidden="true" /> Cadastrar novo contato
                </button>
              }
            />
          )}
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Finalidade" required>
            {() => (
              <Controller
                control={control}
                name="purpose"
                render={({ field }) => (
                  <SegmentedControl
                    label="Finalidade do lead"
                    value={field.value}
                    onChange={field.onChange}
                    className="w-full [&>button]:flex-1 [&>button]:justify-center"
                    options={[
                      { value: 'venda', label: pipelineLabels.venda },
                      { value: 'locacao', label: pipelineLabels.locacao },
                    ]}
                  />
                )}
              />
            )}
          </Field>
          <Field label="Etapa comercial" required error={errors.stage_id?.message}>
            {(fieldProps) => (
              <Select {...fieldProps} disabled={stagesQuery.isLoading} {...register('stage_id')}>
                {stagesQuery.isLoading && <option value="">Carregando etapas…</option>}
                {stages.map((stage) => (
                  <option key={stage.id} value={stage.id}>
                    {stage.name}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <SelectField label="Origem" required options={toOptions(leadSourceLabels)} error={errors.source?.message} {...register('source')} />
          <Field label="Corretor responsável" error={errors.assigned_to?.message}>
            {(fieldProps) => (
              <Select {...fieldProps} disabled={teamQuery.isLoading} {...register('assigned_to')}>
                <option value="">Sem responsável</option>
                {(teamQuery.data ?? []).map((member) => (
                  <option key={member.id} value={member.id}>
                    {memberName(member)}
                    {member.id === profile?.id ? ' (você)' : ''}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Controller
            control={control}
            name="min_budget"
            render={({ field }) => (
              <CurrencyField label="Orçamento mínimo" error={errors.min_budget?.message} value={field.value} onChange={field.onChange} onBlur={field.onBlur} name={field.name} ref={field.ref} />
            )}
          />
          <Controller
            control={control}
            name="max_budget"
            render={({ field }) => (
              <CurrencyField label="Orçamento máximo" error={errors.max_budget?.message} value={field.value} onChange={field.onChange} onBlur={field.onBlur} name={field.name} ref={field.ref} />
            )}
          />
          <TextField label="Região desejada" placeholder="Bairros, cidade ou região" error={errors.desired_region?.message} {...register('desired_region')} />
          <TextField label="Próximo retorno" type="datetime-local" error={errors.next_follow_up_at?.message} {...register('next_follow_up_at')} />
        </div>

        <Field label="Imóveis de interesse" hint="Associe um ou mais imóveis da carteira.">
          {(fieldProps) => (
            <AsyncPicker
              {...fieldProps}
              multiple
              queryKey="lead-property"
              search={searchPropertyOptions}
              selected={properties}
              onChange={setProperties}
              placeholder="Buscar por código, título ou bairro"
              emptyText="Nenhum imóvel encontrado."
            />
          )}
        </Field>

        <TextareaField label="Observações" rows={3} error={errors.notes?.message} {...register('notes')} />
        <RequiredNote />
      </form>

      <ContactFormModal
        open={newContactOpen}
        onClose={() => setNewContactOpen(false)}
        defaultType={purpose === 'locacao' ? 'interessado_locacao' : 'comprador'}
        onSaved={(created) => {
          const option = contactToOption(created)
          setContact([option])
          setValue('contact_id', option.id, { shouldValidate: true })
        }}
      />
    </Modal>
  )
}
