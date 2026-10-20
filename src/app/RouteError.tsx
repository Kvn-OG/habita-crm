import { RefreshCw, TriangleAlert } from 'lucide-react'
import { isRouteErrorResponse, useRouteError } from 'react-router-dom'
import { Button } from '@/components/ui/Button'

/** Fallback para erros inesperados de renderização ou falha ao carregar um módulo. */
export function RouteError() {
  const error = useRouteError()
  const chunkFailed = error instanceof Error && /dynamically imported module|Loading chunk|Failed to fetch/i.test(error.message)
  const message = isRouteErrorResponse(error)
    ? `${error.status} · ${error.statusText}`
    : chunkFailed
      ? 'Uma nova versão do sistema pode ter sido publicada. Recarregue a página.'
      : 'Ocorreu um erro inesperado nesta tela.'

  if (import.meta.env.DEV) console.error(error)

  return (
    <div className="grid min-h-[60vh] place-items-center px-4">
      <div className="max-w-sm text-center">
        <span className="mx-auto grid size-12 place-items-center rounded-full bg-danger-50 text-danger-700" aria-hidden="true">
          <TriangleAlert className="size-5" />
        </span>
        <h2 className="mt-4 text-base font-semibold text-ink">Algo deu errado</h2>
        <p className="mt-1.5 text-[13px] text-muted">{message}</p>
        <Button className="mt-5" variant="secondary" icon={<RefreshCw />} onClick={() => window.location.reload()}>
          Recarregar
        </Button>
      </div>
    </div>
  )
}
