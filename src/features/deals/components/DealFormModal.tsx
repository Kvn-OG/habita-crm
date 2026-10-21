import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { useAuth } from '@/auth/AuthContext'
import { useToast } from '@/components/feedback/Toast'
import { AsyncPicker, type PickerOption } from '@/components/forms/AsyncPicker'
import { Field, RequiredNote } from '@/components/forms/Field'
import { CurrencyField, Select, TextareaField, TextField } from '@/components/forms/inputs'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { searchLeadOptions } from '@/features/leads/api'
import { searchPropertyOptions } from '@/features/properties/api'
import { memberName, useTeamMembers } from '@/hooks/useTeamMembers'
import { getErrorMessage } from '@/lib/errors'
import { createDeal, DEAL_RELATED_KEYS, updateDeal } from '../api'
import { dealSchema, dealToFormValues, type DealFormValues } from '../schema'
import type { DealOverview } from '../types'
import { dealPropertyLabel } from './DealBadges'

type DealFormModalProps = {
  open: boolean
  onClose: () => void
  deal?: DealOverview | null
  defaultLead?: PickerOption
  defaultProperty?: PickerOption
  onSaved?: (id: string) => void
}

export function DealFormModal(props: DealFormModalProps) {
  if (!props.open) return null
  return <DealFormContent {...props} />
}

function DealFormContent({ onClose, deal, defaultLead, defaultProperty, onSaved }: DealFormModalProps) {
  const queryClient = useQueryClient()
  const toast = useToast()
  const { profile } = useAuth()
  const teamQuery = useTeamMembers()
  const editing = Boolean(deal)

  const [lead, setLead] = useState<PickerOption[]>(() => {
    if (deal) return [{ id: deal.lead_id, label: deal.contact_name }]
    return defaultLead ? [defaultLead] : []
  })
  const [property, setProperty] = useState<PickerOption[]>(() => {
    const label = deal ? dealPropertyLabel(deal) : null
    if (deal?.property_id && label) return [{ id: deal.property_id, label }]
    return !deal && defaultProperty ? [defaultProperty] : []
  })

  const {
    register, control, handleSubmit, setValue,
    formState: { errors },
  } = useForm<DealFormValues>({
    resolver: zodResolver(dealSchema),
    defaultValues: deal
      ? dealToFormValues(deal)
      : {
          lead_id: defaultLead?.id ?? '',
          property_id: defaultProperty?.id ?? '',
          assigned_to: profile?.id ?? '',
          amount: null,
          expected_close_date: '',
          notes: '',
        },
  })

  const save = useMutation({
    mutationFn: (values: DealFormValues) => (deal ? updateDeal(deal.id, values).then(() => deal.id) : createDeal(values)),
    onSuccess: async (id) => {
      await Promise.all(DEAL_RELATED_KEYS.map((queryKey) => queryClient.invalidateQueries({ queryKey })))
      toast.success(editing ? 'Negociação atualizada.' : 'Negociação aberta.', lead[0]?.label)
      onSaved?.(id)
      onClose()
    },
    onError: (error) => toast.error('Não foi possível salvar a negociação', getErrorMessage(error)),
  })

  const onSubmit = handleSubmit((values) => save.mutate(values))

  return (
    <Modal
      open
      size="lg"
      onClose={onClose}
      dismissible={!save.isPending}
      title={editing ? 'Editar negociação' : 'Nova negociação'}
      description={editing ? deal?.contact_name : 'Registre a negociação de venda ou locação de um lead em andamento.'}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={save.isPending}>
            Cancelar
          </Button>
          <Button type="submit" form="deal-form" loading={save.isPending}>
            {editing ? 'Salvar alterações' : 'Abrir negociação'}
          </Button>
        </>
      }
    >
      <form
        id="deal-form"
        className="space-y-5"
        onSubmit={(event) => {
          event.stopPropagation()
          void onSubmit(event)
        }}
        noValidate
      >
        <Field
          label="Lead"
          required
          error={errors.lead_id?.message}
          hint={editing ? 'O lead de uma negociação não pode ser trocado.' : 'O tipo (venda ou locação) acompanha a finalidade do lead.'}
        >
          {(fieldProps) => (
            <AsyncPicker
              {...fieldProps}
              disabled={editing}
              queryKey="deal-lead"
              search={searchLeadOptions}
              selected={lead}
              onChange={(selected) => {
                setLead(selected)
                setValue('lead_id', selected[0]?.id ?? '', { shouldValidate: true })
              }}
              placeholder="Buscar lead em andamento pelo nome do contato"
              emptyText="Nenhum lead em andamento encontrado."
            />
          )}
        </Field>

        <Field label="Imóvel negociado" hint="Ao ganhar a negociação, o imóvel fica como vendido ou alugado.">
          {(fieldProps) => (
            <AsyncPicker
              {...fieldProps}
              queryKey="deal-property"
              search={searchPropertyOptions}
              selected={property}
              onChange={(selected) => {
                setProperty(selected)
                setValue('property_id', selected[0]?.id ?? '')
              }}
              placeholder="Buscar por código, título ou bairro"
              emptyText="Nenhum imóvel encontrado."
            />
          )}
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Controller
            control={control}
            name="amount"
            render={({ field }) => (
              <CurrencyField
                label="Valor negociado"
                hint="Preenchido automaticamente ao aceitar uma proposta."
                error={errors.amount?.message}
                value={field.value}
                onChange={field.onChange}
                onBlur={field.onBlur}
                name={field.name}
                ref={field.ref}
              />
            )}
          />
          <TextField label="Previsão de fechamento" type="date" error={errors.expected_close_date?.message} {...register('expected_close_date')} />
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
        </div>

        <TextareaField label="Observações" rows={3} error={errors.notes?.message} {...register('notes')} />
        <RequiredNote />
      </form>
    </Modal>
  )
}
