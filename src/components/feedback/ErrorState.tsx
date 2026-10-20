import { RefreshCw, ServerCrash } from 'lucide-react'
import { getErrorMessage } from '@/lib/errors'
import { Button } from '../ui/Button'
import { EmptyState } from './EmptyState'

export function ErrorState({
  error,
  title = 'Não foi possível carregar os dados',
  onRetry,
  compact,
}: {
  error: unknown
  title?: string
  onRetry?: () => void
  compact?: boolean
}) {
  return (
    <div role="alert">
      <EmptyState
        compact={compact}
        icon={<ServerCrash className="text-danger-600" />}
        title={title}
        description={getErrorMessage(error)}
        action={
          onRetry && (
            <Button variant="secondary" size="sm" onClick={onRetry} icon={<RefreshCw />}>
              Tentar novamente
            </Button>
          )
        }
      />
    </div>
  )
}
