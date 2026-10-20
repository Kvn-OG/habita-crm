import { DatabaseZap } from 'lucide-react'
import { AuthLayout } from './AuthLayout'

/** Exibida quando as variáveis de ambiente do Supabase não foram configuradas. */
export function SetupRequiredPage() {
  return (
    <AuthLayout>
      <span className="grid size-11 place-items-center rounded-full bg-accent-50 text-accent-700" aria-hidden="true">
        <DatabaseZap className="size-5" />
      </span>
      <h2 className="mt-4 text-lg font-semibold text-ink">Configuração pendente</h2>
      <p className="mt-2 text-[13px] leading-relaxed text-muted">
        A conexão com o Supabase ainda não foi configurada. Sem ela, o CRM não exibe nem armazena dados, e nenhuma informação é simulada.
      </p>
      <ol className="mt-5 list-decimal space-y-2 pl-5 text-[13px] leading-relaxed text-ink/85 marker:text-subtle">
        <li>
          Copie <code className="rounded bg-canvas px-1 py-0.5 text-xs">.env.example</code> para{' '}
          <code className="rounded bg-canvas px-1 py-0.5 text-xs">.env.local</code>.
        </li>
        <li>
          Informe <code className="rounded bg-canvas px-1 py-0.5 text-xs">VITE_SUPABASE_URL</code> e a chave pública{' '}
          <code className="rounded bg-canvas px-1 py-0.5 text-xs">VITE_SUPABASE_ANON_KEY</code>.
        </li>
        <li>Aplique as migrations e reinicie o servidor de desenvolvimento.</li>
      </ol>
      <p className="mt-5 text-xs text-muted">O passo a passo completo está no README do projeto.</p>
    </AuthLayout>
  )
}
