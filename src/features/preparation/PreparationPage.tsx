import { ArrowRight, CircleDashed, Hammer } from 'lucide-react'
import type { ReactNode } from 'react'
import { Badge } from '@/components/ui/Badge'
import { ButtonLink } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'

type PreparationPageProps = {
  icon: ReactNode
  title: string
  description: string
  upcoming: string[]
  meanwhile?: { label: string; to: string; text: string }
}

/** Página de módulo em preparação: deixa claro o que virá, sem simular funcionalidades. */
export function PreparationPage({ icon, title, description, upcoming, meanwhile }: PreparationPageProps) {
  return (
    <div className="mx-auto max-w-3xl">
      <Card className="overflow-hidden">
        <div className="border-b border-line bg-brand-50/60 px-6 py-7 sm:px-8">
          <div className="flex items-start gap-4">
            <span className="grid size-11 shrink-0 place-items-center rounded-lg bg-brand-900 text-mint [&_svg]:size-5" aria-hidden="true">
              {icon}
            </span>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-lg font-semibold text-ink">{title}</h2>
                <Badge tone="accent" dot>
                  Em preparação
                </Badge>
              </div>
              <p className="mt-1.5 max-w-xl text-[13px] leading-relaxed text-muted">{description}</p>
            </div>
          </div>
        </div>
        <div className="px-6 py-6 sm:px-8">
          <h3 className="flex items-center gap-2 text-[13px] font-semibold text-ink">
            <Hammer className="size-4 text-accent-600" aria-hidden="true" />
            Previsto para as próximas etapas
          </h3>
          <ul className="mt-3 space-y-2.5">
            {upcoming.map((item) => (
              <li key={item} className="flex items-start gap-2.5 text-[13px] text-muted">
                <CircleDashed className="mt-0.5 size-3.5 shrink-0 text-subtle" aria-hidden="true" />
                {item}
              </li>
            ))}
          </ul>
          <p className="mt-6 rounded-md border border-dashed border-line-strong bg-canvas px-4 py-3 text-xs leading-relaxed text-muted">
            Este módulo ainda não está ativo. Nenhuma informação desta área é simulada, e o banco de dados já está estruturado para recebê-la.
          </p>
          {meanwhile && (
            <div className="mt-5 flex flex-col gap-3 border-t border-line pt-5 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-[13px] text-muted">{meanwhile.text}</p>
              <ButtonLink to={meanwhile.to} variant="secondary" size="sm">
                {meanwhile.label}
                <ArrowRight />
              </ButtonLink>
            </div>
          )}
        </div>
      </Card>
    </div>
  )
}
