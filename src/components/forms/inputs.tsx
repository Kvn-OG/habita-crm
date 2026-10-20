import { ChevronDown } from 'lucide-react'
import { useState, type InputHTMLAttributes, type Ref, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react'
import {
  centsDigitsToNumber, formatCurrencyInput, formatDecimalInput, maskCep, maskPhone, parseDecimalBR,
} from '@/lib/format'
import { cn } from '@/lib/utils'
import { Field, inputBase, type FieldProps } from './Field'

// ---------------------------------------------------------------------------
// Primitivos
// ---------------------------------------------------------------------------

type InputProps = InputHTMLAttributes<HTMLInputElement> & { ref?: Ref<HTMLInputElement> }

export function Input({ className, ...props }: InputProps) {
  return <input className={cn(inputBase, 'h-9.5', className)} {...props} />
}

type SelectProps = SelectHTMLAttributes<HTMLSelectElement> & { ref?: Ref<HTMLSelectElement> }

export function Select({ className, children, ...props }: SelectProps) {
  return (
    <div className="relative">
      <select className={cn(inputBase, 'h-9.5 appearance-none pr-9', className)} {...props}>
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-subtle" aria-hidden="true" />
    </div>
  )
}

type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & { ref?: Ref<HTMLTextAreaElement> }

export function Textarea({ className, rows = 3, ...props }: TextareaProps) {
  return <textarea rows={rows} className={cn(inputBase, 'min-h-20 resize-y py-2 leading-relaxed', className)} {...props} />
}

// ---------------------------------------------------------------------------
// Campos completos (rótulo + controle + erro), compatíveis com register() do RHF
// ---------------------------------------------------------------------------

export function TextField({ label, required, error, hint, className, ...props }: FieldProps & InputProps) {
  return (
    <Field label={label} required={required} error={error} hint={hint} className={className}>
      {(field) => <Input {...field} {...props} />}
    </Field>
  )
}

export function SelectField({
  label,
  required,
  error,
  hint,
  className,
  options,
  placeholder,
  ...props
}: FieldProps & SelectProps & { options: { value: string; label: string }[]; placeholder?: string }) {
  return (
    <Field label={label} required={required} error={error} hint={hint} className={className}>
      {(field) => (
        <Select {...field} {...props}>
          {placeholder !== undefined && <option value="">{placeholder}</option>}
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </Select>
      )}
    </Field>
  )
}

export function TextareaField({ label, required, error, hint, className, ...props }: FieldProps & TextareaProps) {
  return (
    <Field label={label} required={required} error={error} hint={hint} className={className}>
      {(field) => <Textarea {...field} {...props} />}
    </Field>
  )
}

/** Opções para register() de quantidades inteiras: "" → null. */
export const integerRegisterOptions = {
  setValueAs: (value: unknown) => {
    if (typeof value === 'number') return value
    const text = String(value ?? '').trim()
    return text === '' ? null : Number(text)
  },
}

// ---------------------------------------------------------------------------
// Controles com máscara (usar com <Controller />)
// ---------------------------------------------------------------------------

type ControlledProps<T> = FieldProps &
  Omit<InputProps, 'value' | 'onChange' | 'defaultValue'> & {
    value: T
    onChange: (value: T) => void
  }

/** Moeda em reais: o usuário digita apenas números e o valor é formatado como R$ 0,00. */
export function CurrencyField({ label, required, error, hint, className, value, onChange, ...props }: ControlledProps<number | null>) {
  return (
    <Field label={label} required={required} error={error} hint={hint} className={className}>
      {(field) => (
        <Input
          {...field}
          {...props}
          inputMode="numeric"
          autoComplete="off"
          placeholder={props.placeholder ?? 'R$ 0,00'}
          className="tabular text-right"
          value={formatCurrencyInput(value)}
          onChange={(event) => onChange(centsDigitsToNumber(event.target.value))}
        />
      )}
    </Field>
  )
}

/** Decimal no padrão brasileiro (vírgula), ex.: áreas em m². */
export function DecimalField({
  label,
  required,
  error,
  hint,
  className,
  value,
  onChange,
  suffix,
  ...props
}: ControlledProps<number | null> & { suffix?: string }) {
  const [text, setText] = useState(() => formatDecimalInput(value))

  return (
    <Field label={label} required={required} error={error} hint={hint} className={className}>
      {(field) => (
        <div className="relative">
          <Input
            {...field}
            {...props}
            inputMode="decimal"
            autoComplete="off"
            className={cn('tabular text-right', suffix && 'pr-10')}
            value={text}
            onChange={(event) => {
              const next = event.target.value.replace(/[^\d.,]/g, '')
              setText(next)
              onChange(parseDecimalBR(next))
            }}
            onBlur={(event) => {
              const parsed = parseDecimalBR(text)
              if (parsed !== null && !Number.isNaN(parsed)) setText(formatDecimalInput(parsed))
              props.onBlur?.(event)
            }}
          />
          {suffix && (
            <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-xs text-subtle">{suffix}</span>
          )}
        </div>
      )}
    </Field>
  )
}

export function PhoneField({ label, required, error, hint, className, value, onChange, ...props }: ControlledProps<string>) {
  return (
    <Field label={label} required={required} error={error} hint={hint} className={className}>
      {(field) => (
        <Input
          {...field}
          {...props}
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          placeholder={props.placeholder ?? '(11) 99999-9999'}
          value={maskPhone(value)}
          onChange={(event) => onChange(maskPhone(event.target.value))}
        />
      )}
    </Field>
  )
}

export function CepInput({ value, onChange, ...props }: Omit<InputProps, 'value' | 'onChange'> & { value: string; onChange: (value: string) => void }) {
  return (
    <Input
      {...props}
      inputMode="numeric"
      autoComplete="postal-code"
      placeholder={props.placeholder ?? '00000-000'}
      value={maskCep(value)}
      onChange={(event) => onChange(maskCep(event.target.value))}
    />
  )
}

export function Checkbox({
  label,
  description,
  className,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { label: string; description?: string; ref?: Ref<HTMLInputElement> }) {
  return (
    <label className={cn('flex cursor-pointer items-start gap-2.5 text-[13px]', className)}>
      <input
        type="checkbox"
        className="mt-0.5 size-4 shrink-0 cursor-pointer rounded border-line-strong accent-brand-800"
        {...props}
      />
      <span>
        <span className="font-medium text-ink">{label}</span>
        {description && <span className="block text-xs text-muted">{description}</span>}
      </span>
    </label>
  )
}
