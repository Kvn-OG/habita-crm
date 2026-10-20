import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { ChevronRight, ContactRound, Plus } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { EmptyState } from '@/components/feedback/EmptyState'
import { ErrorState } from '@/components/feedback/ErrorState'
import { FilterSelect, SearchInput } from '@/components/forms/SearchInput'
import { PageHeader } from '@/components/layout/PageHeader'
import { Avatar } from '@/components/ui/Avatar'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { DataTable, type Column } from '@/components/ui/DataTable'
import { TableSkeleton } from '@/components/ui/Feedback'
import { Pagination } from '@/components/ui/Pagination'
import { useDebouncedValue } from '@/hooks/useDebouncedValue'
import { useListParams } from '@/hooks/useListParams'
import { formatDate, formatPhone } from '@/lib/format'
import { contactTypeLabels, toOptions } from '@/lib/labels'
import { CONTACTS_PAGE_SIZE, contactKeys, listContacts } from './api'
import { ContactFormModal } from './components/ContactFormModal'
import { ContactTypeBadge } from './components/ContactTypeBadge'
import type { Contact } from './types'

const FILTER_KEYS = ['q', 'tipo'] as const

const columns: Column<Contact>[] = [
  {
    key: 'name',
    header: 'Nome',
    cell: (contact) => (
      <div className="flex min-w-0 items-center gap-3">
        <Avatar name={contact.full_name} size="sm" />
        <Link to={`/contatos/${contact.id}`} className="truncate font-medium text-ink hover:text-brand-800 hover:underline">
          {contact.full_name}
        </Link>
      </div>
    ),
  },
  {
    key: 'phone',
    header: 'Telefone',
    className: 'whitespace-nowrap tabular',
    cell: (contact) => (
      <div>
        {formatPhone(contact.phone)}
        {contact.whatsapp && <span className="block text-xs text-muted">WhatsApp {formatPhone(contact.whatsapp)}</span>}
      </div>
    ),
  },
  { key: 'email', header: 'E-mail', hideOnTablet: true, cell: (contact) => <span className="text-muted">{contact.email ?? '—'}</span> },
  { key: 'type', header: 'Tipo', cell: (contact) => <ContactTypeBadge type={contact.contact_type} /> },
  { key: 'created', header: 'Cadastrado em', className: 'tabular whitespace-nowrap text-muted', cell: (contact) => formatDate(contact.created_at) },
  {
    key: 'actions',
    header: <span className="sr-only">Ações</span>,
    className: 'w-12 text-right',
    cell: (contact) => (
      <Link
        to={`/contatos/${contact.id}`}
        className="inline-grid size-8 place-items-center rounded-md text-subtle transition-colors hover:bg-hover hover:text-ink"
        aria-label={`Ver detalhes de ${contact.full_name}`}
      >
        <ChevronRight className="size-4" />
      </Link>
    ),
  },
]

export function ContactsPage() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const { values, page, set, hasFilters } = useListParams(FILTER_KEYS)
  const [term, setTerm] = useState(values.q)
  const debouncedTerm = useDebouncedValue(term, 350)
  const [creating, setCreating] = useState(() => searchParams.get('novo') === '1')

  useEffect(() => {
    if (debouncedTerm !== values.q) set({ q: debouncedTerm })
  }, [debouncedTerm, values.q, set])

  // Atalho vindo do painel (?novo=1): abre o cadastro e limpa o parâmetro.
  useEffect(() => {
    if (searchParams.get('novo') === '1') {
      const next = new URLSearchParams(searchParams)
      next.delete('novo')
      setSearchParams(next, { replace: true })
    }
  }, [searchParams, setSearchParams])

  const query = useQuery({
    queryKey: contactKeys.list(values, page),
    queryFn: () => listContacts(values, page),
    placeholderData: keepPreviousData,
  })

  const clearFilters = () => {
    setTerm('')
    set({ q: null, tipo: null })
  }

  return (
    <>
      <PageHeader
        description="Compradores, interessados em locação e proprietários com quem a imobiliária se relaciona."
        actions={
          <Button icon={<Plus />} onClick={() => setCreating(true)}>
            Novo contato
          </Button>
        }
      />

      <Card>
        <div className="flex flex-col gap-3 border-b border-line p-4 sm:flex-row sm:items-center">
          <SearchInput className="sm:max-w-sm sm:flex-1" label="Buscar contatos" placeholder="Nome, telefone ou e-mail" value={term} onChange={setTerm} />
          <div className="flex gap-2 sm:ml-auto">
            <FilterSelect label="Filtrar por tipo" allLabel="Todos os tipos" value={values.tipo} onChange={(tipo) => set({ tipo })} options={toOptions(contactTypeLabels)} />
            {hasFilters && (
              <Button variant="ghost" onClick={clearFilters}>
                Limpar
              </Button>
            )}
          </div>
        </div>

        {query.isLoading ? (
          <TableSkeleton />
        ) : query.isError ? (
          <ErrorState error={query.error} onRetry={() => void query.refetch()} />
        ) : query.data && query.data.rows.length > 0 ? (
          <div className={query.isFetching ? 'opacity-70 transition-opacity' : undefined}>
            <DataTable
              caption="Lista de contatos"
              rows={query.data.rows}
              columns={columns}
              rowKey={(contact) => contact.id}
              onRowClick={(contact) => navigate(`/contatos/${contact.id}`)}
              mobileItem={(contact) => (
                <Link to={`/contatos/${contact.id}`} className="flex items-center gap-3 px-4 py-3.5 active:bg-hover">
                  <Avatar name={contact.full_name} size="md" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-medium text-ink">{contact.full_name}</p>
                    <p className="text-xs text-muted tabular">{formatPhone(contact.phone)}</p>
                  </div>
                  <ContactTypeBadge type={contact.contact_type} />
                </Link>
              )}
            />
            <Pagination page={page} pageSize={CONTACTS_PAGE_SIZE} total={query.data.count} onPageChange={(pagina) => set({ pagina })} />
          </div>
        ) : hasFilters ? (
          <EmptyState
            icon={<ContactRound />}
            title="Nenhum contato encontrado"
            description="Tente buscar por outro nome, telefone ou e-mail."
            action={
              <Button variant="secondary" onClick={clearFilters}>
                Limpar filtros
              </Button>
            }
          />
        ) : (
          <EmptyState
            icon={<ContactRound />}
            title="Nenhum contato cadastrado"
            description="Cadastre compradores, interessados e proprietários para relacioná-los a leads e imóveis."
            action={
              <Button icon={<Plus />} onClick={() => setCreating(true)}>
                Adicionar contato
              </Button>
            }
          />
        )}
      </Card>

      <ContactFormModal open={creating} onClose={() => setCreating(false)} onSaved={(contact) => navigate(`/contatos/${contact.id}`)} />
    </>
  )
}
