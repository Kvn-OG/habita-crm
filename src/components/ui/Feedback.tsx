import { LoaderCircle } from 'lucide-react'
import { cn } from '@/lib/utils'

export function Spinner({ className, label = 'Carregando' }: { className?: string; label?: string }) {
  return (
    <span role="status" className="inline-flex items-center">
      <LoaderCircle className={cn('size-5 animate-spin text-brand-700', className)} aria-hidden="true" />
      <span className="sr-only">{label}</span>
    </span>
  )
}

/** Tela de carregamento centralizada (verificação de sessão, rotas lazy). */
export function LoadingScreen({ label = 'Carregando' }: { label?: string }) {
  return (
    <div className="grid min-h-[50vh] place-items-center" role="status" aria-live="polite">
      <div className="flex items-center gap-3 text-sm text-muted">
        <LoaderCircle className="size-5 animate-spin text-brand-700" aria-hidden="true" />
        <span>{label}…</span>
      </div>
    </div>
  )
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded-md bg-line/70', className)} aria-hidden="true" />
}

/** Linhas de esqueleto para listas e tabelas em carregamento. */
export function TableSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="divide-y divide-line" role="status" aria-label="Carregando registros">
      {Array.from({ length: rows }, (_, index) => (
        <div key={index} className="flex items-center gap-4 px-5 py-4">
          <Skeleton className="h-4 w-16" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-3.5 w-2/5" />
            <Skeleton className="h-3 w-1/4" />
          </div>
          <Skeleton className="hidden h-4 w-24 sm:block" />
          <Skeleton className="hidden h-5 w-20 md:block" />
        </div>
      ))}
    </div>
  )
}
