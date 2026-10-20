import { LogIn, MonitorSmartphone } from 'lucide-react'
import { useState } from 'react'
import { Alert } from '@/components/feedback/Alert'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { describeDevice } from '@/lib/devices'
import { formatRelative } from '@/lib/format'
import type { OtherSession } from './AuthContext'

/** Login de uma conta que já tem sessão aberta em outro dispositivo. */
export function SessionConflictModal({
  sessions,
  onResolve,
}: {
  sessions: OtherSession[]
  onResolve: (choice: 'end-others' | 'cancel') => Promise<string | null>
}) {
  const [pending, setPending] = useState<'end-others' | 'cancel' | null>(null)
  const [error, setError] = useState<string | null>(null)

  const choose = async (choice: 'end-others' | 'cancel') => {
    setPending(choice)
    setError(null)
    const message = await onResolve(choice)
    if (message) {
      setError(message)
      setPending(null)
    }
  }

  return (
    <Modal
      open
      onClose={() => void choose('cancel')}
      dismissible={pending === null}
      title="Sua conta já está aberta em outro dispositivo"
      description="Para evitar acessos duplicados, a conta só pode ficar conectada em um lugar por vez."
      footer={
        <>
          <Button variant="secondary" onClick={() => void choose('cancel')} disabled={pending !== null} loading={pending === 'cancel'}>
            Cancelar login
          </Button>
          <Button icon={<LogIn />} onClick={() => void choose('end-others')} disabled={pending !== null} loading={pending === 'end-others'}>
            Encerrar a outra sessão e entrar
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <ul className="divide-y divide-line rounded-md border border-line">
          {sessions.map((item) => (
            <li key={item.id} className="flex items-center gap-3 px-3.5 py-3">
              <MonitorSmartphone className="size-5 shrink-0 text-muted" aria-hidden="true" />
              <div className="min-w-0">
                <p className="truncate text-[13px] font-medium text-ink">{describeDevice(item.user_agent)}</p>
                <p className="text-xs text-muted">Último uso {formatRelative(item.last_active_at)}</p>
              </div>
            </li>
          ))}
        </ul>
        <p className="text-xs leading-relaxed text-muted">
          Ao encerrar, quem estiver usando a conta no outro dispositivo será desconectado. Ao cancelar, nada muda por lá.
        </p>
        {error && <Alert tone="danger">{error}</Alert>}
      </div>
    </Modal>
  )
}
