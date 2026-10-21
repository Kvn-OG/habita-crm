import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Controller, useForm } from 'react-hook-form'
import { useToast } from '@/components/feedback/Toast'
import { RequiredNote } from '@/components/forms/Field'
import { CurrencyField, SelectField, TextareaField, TextField } from '@/components/forms/inputs'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { getErrorMessage } from '@/lib/errors'
import { proposalStatusLabels, toOptions } from '@/lib/labels'
import { createProposal, DEAL_RELATED_KEYS, updateProposal } from '../api'
import { proposalSchema, proposalToFormValues, type ProposalFormValues } from '../schema'
import type { Proposal } from '../types'

type ProposalFormModalProps = {
  open: boolean
  onClose: () => void
  dealId: string
  proposal?: Proposal | null
  /** Valor sugerido para uma nova proposta (ex.: preço do imóvel ou última proposta). */
  suggestedAmount?: number | null
}

export function ProposalFormModal(props: ProposalFormModalProps) {
  if (!props.open) return null
  return <ProposalFormContent {...props} />
}

function ProposalFormContent({ onClose, dealId, proposal, suggestedAmount }: ProposalFormModalProps) {
  const queryClient = useQueryClient()
  const toast = useToast()
  const editing = Boolean(proposal)

  const {
    register, control, handleSubmit,
    formState: { errors },
  } = useForm<ProposalFormValues>({
    resolver: zodResolver(proposalSchema),
    defaultValues: proposal
      ? proposalToFormValues(proposal)
      : { amount: suggestedAmount ?? null, status: 'enviada', valid_until: '', conditions: '' },
  })

  const save = useMutation({
    mutationFn: (values: ProposalFormValues) => (proposal ? updateProposal(proposal.id, values) : createProposal(dealId, values)),
    onSuccess: async () => {
      await Promise.all(DEAL_RELATED_KEYS.map((queryKey) => queryClient.invalidateQueries({ queryKey })))
      toast.success(editing ? 'Proposta atualizada.' : 'Proposta registrada.')
      onClose()
    },
    onError: (error) => toast.error('Não foi possível salvar a proposta', getErrorMessage(error)),
  })

  const onSubmit = handleSubmit((values) => save.mutate(values))

  return (
    <Modal
      open
      size="md"
      onClose={onClose}
      dismissible={!save.isPending}
      title={editing ? 'Editar proposta' : 'Nova proposta'}
      description="Proposta ou contraproposta de valor e condições."
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={save.isPending}>
            Cancelar
          </Button>
          <Button type="submit" form="proposal-form" loading={save.isPending}>
            {editing ? 'Salvar alterações' : 'Registrar proposta'}
          </Button>
        </>
      }
    >
      <form
        id="proposal-form"
        className="space-y-5"
        onSubmit={(event) => {
          event.stopPropagation()
          void onSubmit(event)
        }}
        noValidate
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Controller
            control={control}
            name="amount"
            render={({ field }) => (
              <CurrencyField
                label="Valor"
                required
                error={errors.amount?.message}
                value={field.value}
                onChange={field.onChange}
                onBlur={field.onBlur}
                name={field.name}
                ref={field.ref}
              />
            )}
          />
          <SelectField
            label="Situação"
            required
            options={toOptions(proposalStatusLabels)}
            hint="Ao aceitar, o valor passa a ser o da negociação."
            error={errors.status?.message}
            {...register('status')}
          />
          <TextField label="Válida até" type="date" error={errors.valid_until?.message} {...register('valid_until')} />
        </div>
        <TextareaField
          label="Condições"
          rows={4}
          placeholder="Forma de pagamento, entrada, financiamento, prazo, garantia locatícia…"
          error={errors.conditions?.message}
          {...register('conditions')}
        />
        <RequiredNote />
      </form>
    </Modal>
  )
}
