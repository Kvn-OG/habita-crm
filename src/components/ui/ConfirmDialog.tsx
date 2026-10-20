import { TriangleAlert } from 'lucide-react'
import type { ReactNode } from 'react'
import { Button } from './Button'
import { Modal } from './Modal'

type ConfirmDialogProps = {
  open: boolean
  title: string
  description: ReactNode
  confirmLabel?: string
  cancelLabel?: string
  tone?: 'danger' | 'primary'
  loading?: boolean
  onConfirm: () => void
  onCancel: () => void
}

/** Confirmação explícita para ações irreversíveis (substitui window.confirm). */
export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  tone = 'danger',
  loading = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  return (
    <Modal
      open={open}
      onClose={onCancel}
      size="sm"
      dismissible={!loading}
      title={
        <span className="flex items-center gap-2.5">
          {tone === 'danger' && (
            <span className="grid size-8 place-items-center rounded-full bg-danger-50 text-danger-700">
              <TriangleAlert className="size-4" aria-hidden="true" />
            </span>
          )}
          {title}
        </span>
      }
      footer={
        <>
          <Button variant="secondary" onClick={onCancel} disabled={loading}>
            {cancelLabel}
          </Button>
          <Button variant={tone === 'danger' ? 'danger' : 'primary'} onClick={onConfirm} loading={loading} autoFocus>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <div className="text-sm leading-relaxed text-muted">{description}</div>
    </Modal>
  )
}
