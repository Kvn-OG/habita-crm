import { Building2 } from 'lucide-react'
import type { ReactNode } from 'react'
import iconMenta from '@/assets/brand/icon-menta.svg'
import { AGENCY_NAME, APP_SLOGAN } from '@/app/brand'
import { BrandLogo } from '@/components/layout/BrandMark'

/** Layout das telas públicas de autenticação (login, recuperação de senha). */
export function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <main className="grid min-h-dvh lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
      <section className="relative hidden overflow-hidden bg-brand-900 text-white lg:flex lg:flex-col lg:justify-between lg:p-12">
        {/* Símbolo da marca em grande escala, como elemento gráfico discreto */}
        <img
          src={iconMenta}
          alt=""
          aria-hidden="true"
          className="pointer-events-none absolute -right-24 -bottom-16 w-[420px] opacity-[0.06] select-none"
        />
        <BrandLogo surface="dark" className="relative h-9 self-start" />
        <div className="relative max-w-md">
          <p className="font-display text-sm font-semibold tracking-wide text-mint">{APP_SLOGAN}</p>
          <h1 className="mt-4 text-[34px] leading-[1.15] font-bold tracking-tight text-balance">
            Cada imóvel, cliente e oportunidade em um só lugar.
          </h1>
          <p className="mt-4 text-sm leading-relaxed text-brand-200">
            Organize a carteira de imóveis, os contatos e o acompanhamento de vendas e locações da sua equipe.
          </p>
        </div>
        <p className="relative flex items-center gap-2 text-xs text-brand-200">
          <Building2 className="size-3.5 text-mint" aria-hidden="true" />
          {AGENCY_NAME ?? 'CRM para imobiliárias'}
        </p>
      </section>

      <section className="flex flex-col items-center justify-center bg-canvas px-4 py-10 sm:px-8">
        <div className="mb-8 flex flex-col items-center gap-2 lg:hidden">
          <BrandLogo surface="light" className="h-9" />
          <p className="font-display text-[13px] font-semibold text-accent-700">{APP_SLOGAN}</p>
        </div>
        <div className="w-full max-w-[400px] rounded-xl border border-line bg-surface p-6 shadow-card sm:p-8">{children}</div>
        <p className="mt-6 text-center text-xs text-muted">{AGENCY_NAME ? `Acesso restrito à equipe da ${AGENCY_NAME}.` : 'Acesso restrito à equipe da imobiliária.'}</p>
      </section>
    </main>
  )
}
