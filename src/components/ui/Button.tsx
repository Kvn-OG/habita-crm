import { LoaderCircle } from 'lucide-react'
import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { Link, type LinkProps } from 'react-router-dom'
import { cn } from '@/lib/utils'

export type ButtonVariant = 'primary' | 'accent' | 'secondary' | 'ghost' | 'danger' | 'danger-ghost'
export type ButtonSize = 'sm' | 'md' | 'icon' | 'icon-sm'

const base =
  'inline-flex shrink-0 select-none items-center justify-center gap-2 whitespace-nowrap rounded-md font-medium ' +
  'transition-[background-color,color,border-color,box-shadow] duration-150 ' +
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-700 ' +
  'disabled:pointer-events-none disabled:opacity-50 aria-busy:cursor-wait'

const variants: Record<ButtonVariant, string> = {
  primary: 'bg-brand-900 text-white shadow-sm hover:bg-brand-800 active:bg-brand-950',
  accent: 'bg-mint text-brand-900 shadow-sm hover:bg-accent-300 active:bg-accent-300',
  secondary: 'border border-line-strong bg-surface text-ink shadow-xs hover:border-subtle/60 hover:bg-hover',
  ghost: 'text-muted hover:bg-hover hover:text-ink',
  danger: 'bg-danger-600 text-white shadow-sm hover:bg-danger-700',
  'danger-ghost': 'text-danger-700 hover:bg-danger-50',
}

const sizes: Record<ButtonSize, string> = {
  sm: 'h-8 px-3 text-[13px] [&_svg]:size-4',
  md: 'h-9.5 px-4 text-sm [&_svg]:size-4',
  icon: 'size-9.5 [&_svg]:size-[18px]',
  'icon-sm': 'size-8 [&_svg]:size-4',
}

export function buttonClasses(variant: ButtonVariant = 'primary', size: ButtonSize = 'md', className?: string) {
  return cn(base, variants[variant], sizes[size], className)
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant
  size?: ButtonSize
  loading?: boolean
  icon?: ReactNode
}

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  icon,
  className,
  children,
  disabled,
  type = 'button',
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={buttonClasses(variant, size, className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : icon}
      {children}
    </button>
  )
}

type IconButtonProps = Omit<ButtonProps, 'icon' | 'children'> & {
  label: string
  children: ReactNode
}

/** Botão apenas com ícone: exige um rótulo acessível. */
export function IconButton({ label, children, variant = 'ghost', size = 'icon-sm', ...props }: IconButtonProps) {
  return (
    <Button variant={variant} size={size} aria-label={label} title={label} {...props}>
      {children}
    </Button>
  )
}

type ButtonLinkProps = LinkProps & {
  variant?: ButtonVariant
  size?: ButtonSize
  icon?: ReactNode
}

export function ButtonLink({ variant = 'primary', size = 'md', icon, className, children, ...props }: ButtonLinkProps) {
  return (
    <Link className={buttonClasses(variant, size, className)} {...props}>
      {icon}
      {children}
    </Link>
  )
}
