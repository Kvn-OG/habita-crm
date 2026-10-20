import iconMenta from '@/assets/brand/icon-menta.svg'
import iconPrincipal from '@/assets/brand/icon.svg'
import logoMenta from '@/assets/brand/logo-menta.svg'
import logoPrincipal from '@/assets/brand/logo-principal.svg'
import { APP_NAME } from '@/app/brand'
import { cn } from '@/lib/utils'

type Surface = 'dark' | 'light'

/**
 * Logotipo completo da Habita (ícone + nome).
 * "dark": versão menta para fundos verde-escuros; "light": versão verde para fundos claros.
 */
export function BrandLogo({ surface = 'light', className }: { surface?: Surface; className?: string }) {
  return (
    <img
      src={surface === 'dark' ? logoMenta : logoPrincipal}
      alt={APP_NAME}
      width={455}
      height={84}
      className={cn(className ?? 'h-7', 'w-auto select-none')}
      draggable={false}
    />
  )
}

/** Apenas o símbolo (casa com "H"), para espaços reduzidos. */
export function BrandIcon({ surface = 'light', className }: { surface?: Surface; className?: string }) {
  return (
    <img
      src={surface === 'dark' ? iconMenta : iconPrincipal}
      alt={APP_NAME}
      width={167}
      height={139}
      className={cn(className ?? 'h-7', 'w-auto select-none')}
      draggable={false}
    />
  )
}
