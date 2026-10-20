import type { ReactNode } from 'react'

/** Linha de abertura da página: descrição e ações principais (o título fica no cabeçalho). */
export function PageHeader({ description, actions, children }: { description?: ReactNode; actions?: ReactNode; children?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {children}
        {description && <p className="max-w-2xl text-[13px] leading-relaxed text-muted">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )
}
