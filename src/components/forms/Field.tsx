import { useId, type ReactNode } from 'react'
import { cn } from '@/lib/utils'

export type FieldProps = {
  label: string
  required?: boolean
  error?: string
  hint?: ReactNode
  className?: string
}

/**
 * Estrutura de campo: rótulo, indicador de obrigatório, dica e mensagem de erro,
 * com associação acessível (aria-describedby / aria-invalid).
 */
export function Field({
  label,
  required,
  error,
  hint,
  className,
  children,
}: FieldProps & {
  children: (props: { id: string; 'aria-invalid'?: true; 'aria-describedby'?: string; 'aria-required'?: true }) => ReactNode
}) {
  const id = useId()
  const hintId = `${id}-hint`
  const errorId = `${id}-error`
  const describedBy = [hint ? hintId : null, error ? errorId : null].filter(Boolean).join(' ') || undefined

  return (
    <div className={cn('flex min-w-0 flex-col gap-1.5', className)}>
      <label htmlFor={id} className="text-[13px] font-medium text-ink">
        {label}
        {required && (
          <span className="ml-0.5 text-accent-700" aria-hidden="true">
            *
          </span>
        )}
      </label>
      {children({
        id,
        'aria-invalid': error ? true : undefined,
        'aria-describedby': describedBy,
        'aria-required': required ? true : undefined,
      })}
      {hint && !error && (
        <p id={hintId} className="text-xs text-muted">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className="text-xs font-medium text-danger-700">
          {error}
        </p>
      )}
    </div>
  )
}

export const inputBase =
  'block w-full rounded-md border border-line-strong bg-surface px-3 text-sm text-ink shadow-xs ' +
  'placeholder:text-subtle transition-[border-color,box-shadow] duration-150 ' +
  'hover:border-subtle/70 focus:border-brand-700 focus:outline-none focus:ring-3 focus:ring-brand-700/12 ' +
  'disabled:cursor-not-allowed disabled:bg-canvas disabled:text-muted ' +
  'aria-invalid:border-danger-600 aria-invalid:focus:ring-danger-600/12'

export function FormSection({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return (
    <section className="grid gap-x-8 gap-y-4 border-b border-line py-6 first:pt-0 last:border-b-0 last:pb-0 lg:grid-cols-[220px_1fr]">
      <div>
        <h3 className="text-sm font-semibold text-ink">{title}</h3>
        {description && <p className="mt-1 text-xs leading-relaxed text-muted">{description}</p>}
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">{children}</div>
    </section>
  )
}

export function RequiredNote() {
  return (
    <p className="text-xs text-muted">
      Campos marcados com <span className="font-semibold text-accent-700">*</span> são obrigatórios.
    </p>
  )
}
