import { useQuery } from '@tanstack/react-query'
import { searchCommands } from '@/app/commands'
import { useAuth } from '@/auth/AuthContext'
import { Building2, ContactRound, Search, Target } from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { EmptyState } from '@/components/feedback/EmptyState'
import { ErrorState } from '@/components/feedback/ErrorState'
import { SearchInput } from '@/components/forms/SearchInput'
import { Card, CardHeader } from '@/components/ui/Card'
import { TableSkeleton } from '@/components/ui/Feedback'
import { ContactTypeBadge } from '@/features/contacts/components/ContactTypeBadge'
import { LeadStageBadge } from '@/features/leads/components/LeadBadges'
import { formatAddress, PropertyStatusBadge } from '@/features/properties/components/PropertyBadges'
import { useDebouncedValue } from '@/hooks/useDebouncedValue'
import { formatPhone, normalizePhone } from '@/lib/format'
import { pipelineLabels } from '@/lib/labels'
import { getSupabase } from '@/lib/supabase'
import { sanitizeSearchTerm } from '@/lib/utils'
import type { ContactType, Pipeline, PropertyStatus, StageCategory } from '@/types/domain'

type Results = {
  properties: { id: string; code: string; title: string; status: PropertyStatus; neighborhood: string | null; city: string | null; state: string | null }[]
  contacts: { id: string; full_name: string; phone: string; contact_type: ContactType }[]
  leads: { id: string; contact_name: string; purpose: Pipeline; stage_name: string; stage_category: StageCategory; desired_region: string | null }[]
}

async function searchAll(raw: string): Promise<Results> {
  const term = sanitizeSearchTerm(raw)
  const digits = normalizePhone(term)
  const supabase = getSupabase()
  const contactClauses = [`full_name.ilike.%${term}%`, `email.ilike.%${term}%`]
  if (digits.length >= 3) contactClauses.push(`phone.ilike.%${digits}%`)

  const [properties, contacts, leads] = await Promise.all([
    supabase
      .from('properties')
      .select('id,code,title,status,neighborhood,city,state')
      .or(`code.ilike.%${term}%,title.ilike.%${term}%,city.ilike.%${term}%,neighborhood.ilike.%${term}%`)
      .limit(8),
    supabase.from('contacts').select('id,full_name,phone,contact_type').or(contactClauses.join(',')).limit(8),
    supabase
      .from('lead_overview')
      .select('id,contact_name,purpose,stage_name,stage_category,desired_region')
      .or(`contact_name.ilike.%${term}%,desired_region.ilike.%${term}%`)
      .order('created_at', { ascending: false })
      .limit(8),
  ])
  const error = properties.error ?? contacts.error ?? leads.error
  if (error) throw error
  return {
    properties: (properties.data ?? []) as Results['properties'],
    contacts: (contacts.data ?? []) as Results['contacts'],
    leads: (leads.data ?? []) as Results['leads'],
  }
}

function Section({ title, icon, count, children }: { title: string; icon: ReactNode; count: number; children: ReactNode }) {
  return (
    <Card>
      <CardHeader
        title={
          <span className="flex items-center gap-2 [&_svg]:size-4 [&_svg]:text-brand-700">
            {icon} {title}
          </span>
        }
        actions={<span className="text-xs text-muted tabular">{count}</span>}
      />
      {count ? <ul className="divide-y divide-line">{children}</ul> : <p className="px-5 py-6 text-center text-xs text-muted">Nenhum resultado.</p>}
    </Card>
  )
}

export function SearchPage() {
  const [params, setParams] = useSearchParams()
  const [term, setTerm] = useState(params.get('q') ?? '')
  const debounced = useDebouncedValue(term.trim(), 350)
  const active = sanitizeSearchTerm(debounced).length >= 2

  useEffect(() => {
    setParams(debounced ? { q: debounced } : {}, { replace: true })
  }, [debounced, setParams])

  const query = useQuery({ queryKey: ['search', debounced], queryFn: () => searchAll(debounced), enabled: active })
  const total = query.data ? query.data.properties.length + query.data.contacts.length + query.data.leads.length : 0
  const shortcuts = searchCommands(term, 8, useAuth().permissions.isAdmin)

  return (
    <div className="space-y-5">
      <SearchInput className="max-w-xl" label="Pesquisar no CRM" placeholder="Ação, página, imóvel, contato, telefone…" value={term} onChange={setTerm} />

      {shortcuts.length > 0 && (
        <section aria-label="Ações e páginas">
          <h2 className="mb-2 text-xs font-semibold tracking-wide text-subtle uppercase">Ir para</h2>
          <ul className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
            {shortcuts.map((command) => (
              <li key={command.id}>
                <Link
                  to={command.to}
                  className="flex items-center gap-3 rounded-lg border border-line bg-surface px-3.5 py-3 shadow-card transition-colors hover:border-brand-700/30 hover:bg-brand-50/60"
                >
                  <span className="grid size-8 shrink-0 place-items-center rounded-md bg-brand-900 text-mint [&_svg]:size-4" aria-hidden="true">
                    <command.icon />
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-[13px] font-medium text-ink">{command.label}</span>
                    <span className="block truncate text-xs text-muted">{command.description}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {!active ? (
        <Card>
          <EmptyState icon={<Search />} title="Pesquise em todo o CRM" description="Digite pelo menos 2 caracteres para buscar imóveis, contatos e leads ao mesmo tempo." />
        </Card>
      ) : query.isLoading ? (
        <Card>
          <TableSkeleton rows={4} />
        </Card>
      ) : query.isError ? (
        <Card>
          <ErrorState error={query.error} onRetry={() => void query.refetch()} />
        </Card>
      ) : query.data && total === 0 && shortcuts.length === 0 ? (
        <Card>
          <EmptyState icon={<Search />} title="Nenhum resultado encontrado" description={`Nada corresponde a “${debounced}”. Verifique a grafia ou tente outro termo.`} />
        </Card>
      ) : query.data && total > 0 ? (
        <div className="grid gap-5 xl:grid-cols-3">
          <Section title="Imóveis" icon={<Building2 />} count={query.data.properties.length}>
            {query.data.properties.map((property) => (
              <li key={property.id}>
                <Link to={`/imoveis/${property.id}`} className="block px-5 py-3 transition-colors hover:bg-hover">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-xs font-semibold text-brand-800">{property.code}</span>
                    <PropertyStatusBadge status={property.status} />
                  </div>
                  <p className="mt-0.5 truncate text-[13px] font-medium text-ink">{property.title}</p>
                  <p className="truncate text-xs text-muted">{formatAddress(property)}</p>
                </Link>
              </li>
            ))}
          </Section>
          <Section title="Contatos" icon={<ContactRound />} count={query.data.contacts.length}>
            {query.data.contacts.map((contact) => (
              <li key={contact.id}>
                <Link to={`/contatos/${contact.id}`} className="flex items-center justify-between gap-3 px-5 py-3 transition-colors hover:bg-hover">
                  <span className="min-w-0">
                    <span className="block truncate text-[13px] font-medium text-ink">{contact.full_name}</span>
                    <span className="block text-xs text-muted tabular">{formatPhone(contact.phone)}</span>
                  </span>
                  <ContactTypeBadge type={contact.contact_type} />
                </Link>
              </li>
            ))}
          </Section>
          <Section title="Leads" icon={<Target />} count={query.data.leads.length}>
            {query.data.leads.map((lead) => (
              <li key={lead.id}>
                <Link to={`/leads/${lead.id}`} className="block px-5 py-3 transition-colors hover:bg-hover">
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-[13px] font-medium text-ink">{lead.contact_name}</span>
                    <LeadStageBadge name={lead.stage_name} category={lead.stage_category} />
                  </div>
                  <p className="truncate text-xs text-muted">
                    {pipelineLabels[lead.purpose]}
                    {lead.desired_region && ` · ${lead.desired_region}`}
                  </p>
                </Link>
              </li>
            ))}
          </Section>
        </div>
      ) : null}
    </div>
  )
}
