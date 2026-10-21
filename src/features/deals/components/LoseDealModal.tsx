import { zodResolver } from '@hookform/resolvers/zod'
import { useForm, useWatch } from 'react-hook-form'
import { SelectField, TextareaField } from '@/components/forms/inputs'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { LOSS_REASONS } from '@/lib/labels'
import { lossReasonText, lossSchema, type LossFormValues } from '../schema'

type LoseDealModalProps = {
  open: boolean
  loading: boolean
  onCancel: () => void
  onConfirm: (reason: string) => void
}

const reasonOptions = [...LOSS_REASONS.map((reason) => ({ value: reason, label: reason })), { value: 'outro', label: 'Outro motivo' }]

export function LoseDealModal(props: LoseDealModalProps) {
  if (!props.open) return null
  return <LoseDealContent {...props} />
}

function LoseDealContent({ loading, onCancel, onConfirm }: LoseDealModalProps) {
  const {
    register, control, handleSubmit,
    formState: { errors },
  } = useForm<LossFormValues>({ resolver: zodResolver(lossSchema), defaultValues: { reason: '', details: '' } })
  const reason = useWatch({ control, name: 'reason' })
  const onSubmit = handleSubmit((values) => onConfirm(lossReasonText(values)))

  return (
    <Modal
      open
      size="sm"
      onClose={onCancel}
      dismissible={!loading}
      title="Marcar negociação como perdida"
      description="O motivo aparece nos relatórios e ajuda a entender as perdas."
      footer={
        <>
          <Button variant="secondary" onClick={onCancel} disabled={loading}>
            Voltar
          </Button>
          <Button type="submit" form="lose-deal-form" variant="danger" loading={loading}>
            Marcar como perdida
          </Button>
        </>
      }
    >
      <form
        id="lose-deal-form"
        className="space-y-4"
        onSubmit={(event) => {
          event.stopPropagation()
          void onSubmit(event)
        }}
        noValidate
      >
        <SelectField label="Motivo da perda" required placeholder="Selecione" options={reasonOptions} error={errors.reason?.message} {...register('reason')} />
        <TextareaField
          label={reason === 'outro' ? 'Descreva o motivo' : 'Detalhes'}
          required={reason === 'outro'}
          rows={2}
          error={errors.details?.message}
          {...register('details')}
        />
      </form>
    </Modal>
  )
}
