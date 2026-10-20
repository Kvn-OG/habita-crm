import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Building2, Mail, MessageCircle, Pencil, Phone, Plus, Target, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '@/auth/AuthContext'
import { EmptyState } from '@/components/feedback/EmptyState'
import { ErrorState } from '@/components/feedback/ErrorState'
import { useToast } from '@/components/feedback/Toast'
import { Avatar } from '@/components/ui/Avatar'
import { Button } from '@/components/ui/Button'
import { Card, CardBody, CardHeader } from '@/components/ui/Card'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { DetailItem, DetailList } from '@/components/ui/DetailList'
import { LoadingScreen, Spinner } from '@/components/ui/Feedback'
import { ActivityTimeline } from '@/features/leads/components/ActivityTimeline'
import { FollowUpDate, LeadStageBadge, PipelineBadge } from '@/features/leads/components/LeadBadges'
import { LeadFormModal } from '@/features/leads/components/LeadFormModal'
import { PropertyStatusBadge } from '@/features/properties/components/PropertyBadges'
import { getErrorMessage } from '@/lib/errors'
import { formatDate, formatPhone } from '@/lib/format'
import { contactKeys, contactToOption, deleteContact, getContact, listContactLeads, listOwnedProperties } from './api'
import { ContactFormModal } from './components/ContactFormModal'
import { ContactTypeBadge } from './components/ContactTypeBadge'

export function ContactDetailPage() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const toast = useToast()
  const { permissions } = useAuth()
  const [editing, setEditing] = useState(false)
  const [creatingLead, setCreatingLead] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const query = useQuery({ queryKey: contactKeys.detail(id), queryFn: () => getContact(id) })
  const leadsQuery = useQuery({ queryKey: contactKeys.leads(id), queryFn: () => listContactLeads(id), enabled: query.isSuccess })
  const propertiesQuery = useQuery({ queryKey: contactKeys.properties(id), queryFn: () => listOwnedProperties(id), enabled: query.isSuccess })

  const remove = useMutation({
    mutationFn: () => deleteContact(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: contactKeys.all })
      toast.success('Contato excluído.')
      navigate('/contatos', { replace: true })
    },
    onError: (error) => {
      setConfirmDelete(false)
      toast.error('Não foi possível excluir o contato', getErrorMessage(error))
    },
  })

  if (query.isLoading) return <LoadingScreen label="Carregando contato" />
  if (query.isError || !query.data) {
    return (
      <Card>
        <ErrorState error={query.error} title="Contato não encontrado" onRetry={() => void query.refetch()} />
      </Card>
    )
  }

  const contact = query.data
  const whatsapp = contact.whatsapp ?? contact.phone

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <Link to="/contatos" className="inline-flex items-center gap-1.5 text-xs font-medium text-muted hover:text-ink">
            <ArrowLeft className="size-3.5" aria-hidden="true" /> Contatos
          </Link>
          <div className="mt-3 flex items-center gap-4">
            <Avatar name={contact.full_name} size="lg" />
            <div className="min-w-0">
              <h2 className="truncate text-xl font-semibold tracking-tight text-ink">{contact.full_name}</h2>
              <div className="mt-1">
                <ContactTypeBadge type={contact.contact_type} />
              </div>
            </div>
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          {permissions.canDelete && (
            <Button variant="danger-ghost" icon={<Trash2 />} onClick={() => setConfirmDelete(true)}>
              Excluir
            </Button>
          )}
          <Button variant="secondary" icon={<Pencil />} onClick={() => setEditing(true)}>
            Editar
          </Button>
          <Button icon={<Plus />} onClick={() => setCreatingLead(true)}>
            Novo lead
          </Button>
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-[360px_minmax(0,1fr)]">
        <div className="space-y-5">
          <Card>
            <CardHeader title="Dados de contato" />
            <CardBody>
              <DetailList columns={1}>
                <DetailItem label="Telefone">
                  <a href={`tel:+55${contact.phone}`} className="inline-flex items-center gap-1.5 tabular hover:text-brand-800 hover:underline">
                    <Phone className="size-3.5 text-subtle" aria-hidden="true" /> {formatPhone(contact.phone)}
                  </a>
                </DetailItem>
                <DetailItem label="WhatsApp">
                  <span className="inline-flex items-center gap-1.5 tabular">
                    <MessageCircle className="size-3.5 text-subtle" aria-hidden="true" /> {formatPhone(whatsapp)}
                    {!contact.whatsapp && <span className="text-xs font-normal text-muted">(mesmo do telefone)</span>}
                  </span>
                </DetailItem>
                <DetailItem label="E-mail">
                  {contact.email ? (
                    <a href={`mailto:${contact.email}`} className="inline-flex items-center gap-1.5 break-all hover:text-brand-800 hover:underline">
                      <Mail className="size-3.5 shrink-0 text-subtle" aria-hidden="true" /> {contact.email}
                    </a>
                  ) : null}
                </DetailItem>
                <DetailItem label="Observações">
                  {contact.notes ? <span className="font-normal whitespace-pre-line">{contact.notes}</span> : null}
                </DetailItem>
                <DetailItem label="Cadastrado em">
                  {formatDate(contact.created_at)}
                  {contact.creator_name && <span className="font-normal text-muted"> por {contact.creator_name}</span>}
                </DetailItem>
              </DetailList>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Imóveis como proprietário" />
            {propertiesQuery.isLoading ? (
              <div className="grid place-items-center py-8">
                <Spinner />
              </div>
            ) : propertiesQuery.isError ? (
              <ErrorState compact error={propertiesQuery.error} onRetry={() => void propertiesQuery.refetch()} />
            ) : propertiesQuery.data?.length ? (
              <ul className="divide-y divide-line">
                {propertiesQuery.data.map((property) => (
                  <li key={property.id}>
                    <Link to={`/imoveis/${property.id}`} className="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-hover">
                      <span className="font-mono text-xs font-semibold text-brand-800">{property.code}</span>
                      <span className="min-w-0 flex-1 truncate text-[13px] text-ink">{property.title}</span>
                      <PropertyStatusBadge status={property.status} />
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState compact icon={<Building2 />} title="Nenhum imóvel vinculado" description="Vincule este contato como proprietário no cadastro do imóvel." />
            )}
          </Card>
        </div>

        <div className="min-w-0 space-y-5">
          <Card>
            <CardHeader title="Leads" description="Oportunidades comerciais deste contato" />
            {leadsQuery.isLoading ? (
              <div className="grid place-items-center py-8">
                <Spinner />
              </div>
            ) : leadsQuery.isError ? (
              <ErrorState compact error={leadsQuery.error} onRetry={() => void leadsQuery.refetch()} />
            ) : leadsQuery.data?.length ? (
              <ul className="divide-y divide-line">
                {leadsQuery.data.map((lead) => (
                  <li key={lead.id}>
                    <Link to={`/leads/${lead.id}`} className="flex flex-wrap items-center gap-x-3 gap-y-1.5 px-5 py-3 transition-colors hover:bg-hover">
                      <PipelineBadge pipeline={lead.purpose} />
                      <LeadStageBadge name={lead.stage_name} category={lead.stage_category} />
                      <span className="min-w-0 flex-1 truncate text-[13px] text-muted">{lead.desired_region ?? 'Região não informada'}</span>
                      <span className="text-xs text-muted">
                        {lead.next_follow_up_at ? (
                          <>
                            Retorno <FollowUpDate value={lead.next_follow_up_at} className="text-xs" />
                          </>
                        ) : (
                          `Criado em ${formatDate(lead.created_at)}`
                        )}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState
                compact
                icon={<Target />}
                title="Nenhum lead para este contato"
                description="Crie um lead para acompanhar uma oportunidade de venda ou locação."
                action={
                  <Button size="sm" variant="secondary" icon={<Plus />} onClick={() => setCreatingLead(true)}>
                    Novo lead
                  </Button>
                }
              />
            )}
          </Card>

          <Card>
            <CardHeader title="Histórico" description="Atividades registradas para este contato e seus leads" />
            <ActivityTimeline scope="contact" id={contact.id} />
          </Card>
        </div>
      </div>

      <ContactFormModal open={editing} onClose={() => setEditing(false)} contact={contact} />
      <LeadFormModal
        open={creatingLead}
        onClose={() => setCreatingLead(false)}
        defaultContact={contactToOption(contact)}
        defaultPurpose={contact.contact_type === 'interessado_locacao' ? 'locacao' : 'venda'}
        onSaved={(leadId) => navigate(`/leads/${leadId}`)}
      />
      <ConfirmDialog
        open={confirmDelete}
        title="Excluir contato?"
        description={
          <>
            <strong className="text-ink">{contact.full_name}</strong> será excluído permanentemente. Contatos com leads ou imóveis vinculados não podem ser excluídos.
          </>
        }
        confirmLabel="Excluir contato"
        loading={remove.isPending}
        onConfirm={() => remove.mutate()}
        onCancel={() => setConfirmDelete(false)}
      />
    </div>
  )
}
