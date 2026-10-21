import { useQuery } from '@tanstack/react-query'
import {
  ArrowRight, Building2, CalendarCheck, CalendarClock, ClipboardCheck, ContactRound, Handshake, History,
  House, KeyRound, Target, Trophy, type LucideIcon,
} from 'lucide-react'
import { lazy, Suspense, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '@/auth/AuthContext'
import { EmptyState } from '@/components/feedback/EmptyState'
import { ErrorState } from '@/components/feedback/ErrorState'
import { Card, CardHeader } from '@/components/ui/Card'
import { Skeleton, Spinner } from '@/components/ui/Feedback'
import { SegmentedControl } from '@/components/ui/SegmentedControl'
import { isStageRegression } from '@/features/leads/activityRules'
import { useStages } from '@/features/leads/api'
import { FollowUpDate, LeadStageBadge } from '@/features/leads/components/LeadBadges'
import { formatDate, formatDateTime, formatLongDate, formatNumber, formatRelative, formatTime } from '@/lib/format'
import { activityTypeLabels, pipelineLabels } from '@/lib/labels'
import { cn } from '@/lib/utils'
import type { Pipeline } from '@/types/domain'
import { dashboardKeys, fetchAgenda, fetchFollowUps, fetchMetrics, fetchRecentActivities, type DashboardMetrics } from './api'
import { QuickActions } from './components/QuickActions'

const LeadsByStageChart = lazy(() => import('./components/LeadsByStageChart'))

type MetricDefinition = {
  key: keyof Omit<DashboardMetrics, 'leads_by_stage' | 'rentals_closed'>
  label: string
  icon: LucideIcon
  to: string
  empty: string
  accent?: boolean
}

const metricDefinitions: MetricDefinition[] = [
  { key: 'properties_total', label: 'Imóveis cadastrados', icon: Building2, to: '/imoveis', empty: 'Nenhum imóvel na carteira ainda' },
  { key: 'properties_available', label: 'Imóveis disponíveis', icon: House, to: '/imoveis?situacao=disponivel', empty: 'Nenhum imóvel disponível' },
  { key: 'leads_active', label: 'Leads ativos', icon: Target, to: '/leads', empty: 'Nenhum lead em andamento' },
  { key: 'visits_scheduled', label: 'Visitas agendadas', icon: CalendarCheck, to: '/agenda', empty: 'Nenhuma visita futura' },
  { key: 'negotiations_in_progress', label: 'Negociações em andamento', icon: Handshake, to: '/leads?visao=funil', empty: 'Leads em proposta ou negociação' },
  { key: 'sales_closed', label: 'Vendas concluídas', icon: Trophy, to: '/leads?funil=venda&situacao=concluidos', empty: 'Leads de venda na etapa “Fechado”', accent: true },
]

function MetricCard({ definition, value, loading }: { definition: MetricDefinition; value: number | undefined; loading: boolean }) {
  const Icon = definition.icon
  return (
    <Link
      to={definition.to}
      className="group flex flex-col rounded-lg border border-line bg-surface p-4 shadow-card transition-[box-shadow,border-color] hover:border-line-strong hover:shadow-raised"
    >
      <div className="flex items-start justify-between gap-2">
        <p className="min-h-[2.6em] text-[13px] leading-snug font-medium text-muted">{definition.label}</p>
        <span
          className={cn(
            'grid size-8 shrink-0 place-items-center rounded-md [&_svg]:size-4',
            definition.accent ? 'bg-accent-50 text-accent-700' : 'bg-brand-50 text-brand-800',
          )}
          aria-hidden="true"
        >
          <Icon />
        </span>
      </div>
      {loading ? (
        <Skeleton className="mt-3 h-8 w-16" />
      ) : (
        <p className="mt-2 text-[28px] leading-none font-semibold tracking-tight text-ink tabular">{formatNumber(value ?? 0)}</p>
      )}
      <p className="mt-2 text-xs text-subtle">{!loading && value === 0 ? definition.empty : <span className="invisible sm:visible">Ver detalhes</span>}</p>
    </Link>
  )
}

function Panel({ title, description, action, children, className }: { title: string; description?: string; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <Card className={cn('flex flex-col', className)}>
      <CardHeader title={title} description={description} actions={action} />
      <div className="flex-1">{children}</div>
    </Card>
  )
}

function PanelLink({ to, children }: { to: string; children: ReactNode }) {
  return (
    <Link to={to} className="inline-flex items-center gap-1 text-xs font-medium text-brand-800 hover:underline">
      {children} <ArrowRight className="size-3.5" aria-hidden="true" />
    </Link>
  )
}

function PanelLoading() {
  return (
    <div className="space-y-3 p-5" role="status" aria-label="Carregando">
      <Skeleton className="h-4 w-3/4" />
      <Skeleton className="h-4 w-1/2" />
      <Skeleton className="h-4 w-2/3" />
    </div>
  )
}

export function DashboardPage() {
  const { profile, permissions } = useAuth()
  const teamView = permissions.canViewReports
  const [pipeline, setPipeline] = useState<Pipeline>('venda')
  const metrics = useQuery({ queryKey: dashboardKeys.metrics, queryFn: fetchMetrics })
  const agenda = useQuery({ queryKey: dashboardKeys.agenda, queryFn: fetchAgenda })
  const activitiesQuery = useQuery({ queryKey: dashboardKeys.activities, queryFn: fetchRecentActivities })
  const followUps = useQuery({ queryKey: dashboardKeys.followUps, queryFn: fetchFollowUps })
  const stagesQuery = useStages()

  // Retrocessos de etapa não aparecem no histórico.
  const activities = {
    ...activitiesQuery,
    data: activitiesQuery.data?.filter((activity) => !isStageRegression(activity, stagesQuery.data ?? [])).slice(0, 8),
  }

  const firstName = profile?.full_name.trim().split(/\s+/)[0]
  const hour = Number(new Intl.DateTimeFormat('pt-BR', { hour: 'numeric', hourCycle: 'h23', timeZone: 'America/Sao_Paulo' }).format(new Date()))
  const greeting = hour < 12 ? 'Bom dia' : hour < 18 ? 'Boa tarde' : 'Boa noite'

  const stageRows = (metrics.data?.leads_by_stage ?? []).filter((row) => row.pipeline === pipeline)
  const hasLeads = stageRows.some((row) => row.total > 0)
  const isEmptyWorkspace =
    metrics.isSuccess && metrics.data.properties_total === 0 && metrics.data.leads_active === 0 && (activities.data?.length ?? 0) === 0

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold tracking-tight text-ink">
            {greeting}
            {firstName ? `, ${firstName}` : ''}
          </h2>
          <p className="mt-1 text-[13px] text-muted">
            {teamView
              ? 'Resumo da operação comercial calculado a partir dos registros do CRM.'
              : 'Resumo da sua carteira: seus leads, visitas e negociações, e os imóveis da imobiliária.'}
          </p>
        </div>
        <p className="text-xs text-muted">{formatLongDate()}</p>
      </div>

      {metrics.isError ? (
        <Card>
          <ErrorState error={metrics.error} title="Não foi possível carregar os indicadores" onRetry={() => void metrics.refetch()} />
        </Card>
      ) : (
        <section aria-label="Indicadores" className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
          {metricDefinitions.map((definition) => (
            <MetricCard key={definition.key} definition={definition} value={metrics.data?.[definition.key]} loading={metrics.isLoading} />
          ))}
        </section>
      )}

      {isEmptyWorkspace && (
        <Card className="overflow-hidden">
          <div className="flex flex-col gap-5 p-5 sm:p-6 lg:flex-row lg:items-center">
            <span className="grid size-11 shrink-0 place-items-center rounded-lg bg-brand-900 text-mint" aria-hidden="true">
              <KeyRound className="size-5" />
            </span>
            <div className="flex-1">
              <h3 className="text-[15px] font-semibold text-ink">O Habita está pronto para começar</h3>
              <p className="mt-1 max-w-2xl text-[13px] leading-relaxed text-muted">
                Ainda não há registros. Os indicadores acima serão atualizados automaticamente conforme {teamView ? 'a equipe cadastrar' : 'você cadastrar'} imóveis, contatos, leads e visitas. Nenhum dado demonstrativo é exibido.
              </p>
            </div>
          </div>
        </Card>
      )}

      <div className="grid gap-5 lg:grid-cols-2 xl:grid-cols-3">
        <Panel title="Próximos compromissos" description="Visitas, reuniões e tarefas" action={<PanelLink to="/agenda">Agenda</PanelLink>}>
          {agenda.isLoading ? (
            <PanelLoading />
          ) : agenda.isError ? (
            <ErrorState compact error={agenda.error} onRetry={() => void agenda.refetch()} />
          ) : agenda.data?.length ? (
            <ul className="divide-y divide-line">
              {agenda.data.map((entry) => {
                const content = (
                  <div className="flex items-center gap-3 px-5 py-3">
                    <div className="w-14 shrink-0 text-center">
                      <p className="text-[11px] text-muted">{formatDate(entry.at).slice(0, 5)}</p>
                      <p className="text-[13px] font-semibold text-brand-900 tabular">{formatTime(entry.at)}</p>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-medium text-ink">{entry.title}</p>
                      {entry.subtitle && <p className="truncate text-xs text-muted">{entry.subtitle}</p>}
                    </div>
                    {entry.kind === 'task' ? (
                      <ClipboardCheck className="size-4 shrink-0 text-subtle" aria-label="Tarefa" />
                    ) : (
                      <CalendarClock className="size-4 shrink-0 text-accent-600" aria-label="Compromisso" />
                    )}
                  </div>
                )
                return (
                  <li key={`${entry.kind}-${entry.id}`}>
                    {entry.href ? (
                      <Link to={entry.href} className="block transition-colors hover:bg-hover" title={formatDateTime(entry.at)}>
                        {content}
                      </Link>
                    ) : (
                      content
                    )}
                  </li>
                )
              })}
            </ul>
          ) : (
            <EmptyState compact icon={<CalendarClock />} title="Nenhum compromisso futuro" description="Visitas e reuniões agendadas aparecerão aqui." />
          )}
        </Panel>

        <Panel title="Oportunidades para acompanhar" description="Retornos atrasados ou nos próximos 7 dias" action={<PanelLink to="/leads">Leads</PanelLink>}>
          {followUps.isLoading ? (
            <PanelLoading />
          ) : followUps.isError ? (
            <ErrorState compact error={followUps.error} onRetry={() => void followUps.refetch()} />
          ) : followUps.data?.length ? (
            <ul className="divide-y divide-line">
              {followUps.data.map((lead) => (
                <li key={lead.id}>
                  <Link to={`/leads/${lead.id}`} className="block px-5 py-3 transition-colors hover:bg-hover">
                    <div className="flex items-center justify-between gap-3">
                      <p className="truncate text-[13px] font-medium text-ink">{lead.contact_name}</p>
                      <LeadStageBadge name={lead.stage_name} category={lead.stage_category} />
                    </div>
                    <p className="mt-0.5 flex flex-wrap gap-x-2 text-xs text-muted">
                      <span>{pipelineLabels[lead.purpose]}</span>
                      <span aria-hidden="true">·</span>
                      <FollowUpDate value={lead.next_follow_up_at} className="text-xs" />
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState compact icon={<Target />} title="Nenhum retorno pendente" description="Defina a data do próximo retorno nos leads para acompanhá-los por aqui." />
          )}
        </Panel>

        <QuickActions className="lg:col-span-2 xl:col-span-1" />

        <Panel
          title="Leads por etapa"
          description={`Funil de ${pipelineLabels[pipeline].toLowerCase()}`}
          className="lg:col-span-2 xl:col-span-2"
          action={
            <SegmentedControl
              label="Funil exibido"
              value={pipeline}
              onChange={setPipeline}
              options={[
                { value: 'venda', label: 'Venda' },
                { value: 'locacao', label: 'Locação' },
              ]}
            />
          }
        >
          {metrics.isLoading ? (
            <PanelLoading />
          ) : metrics.isError ? null : hasLeads ? (
            <div className="p-4">
              <Suspense
                fallback={
                  <div className="grid h-40 place-items-center">
                    <Spinner />
                  </div>
                }
              >
                <LeadsByStageChart rows={stageRows} />
              </Suspense>
            </div>
          ) : (
            <EmptyState compact icon={<Target />} title={`Nenhum lead de ${pipelineLabels[pipeline].toLowerCase()}`} description="A distribuição pelas etapas será exibida quando houver leads neste funil." />
          )}
        </Panel>

        <Panel title="Atividades recentes" description={teamView ? 'Últimos registros comerciais da equipe' : 'Seus últimos registros comerciais'}>
          {activities.isLoading ? (
            <PanelLoading />
          ) : activities.isError ? (
            <ErrorState compact error={activities.error} onRetry={() => void activities.refetch()} />
          ) : activities.data?.length ? (
            <ul className="divide-y divide-line">
              {activities.data.map((activity) => {
                const href = activity.lead_id ? `/leads/${activity.lead_id}` : activity.contact_id ? `/contatos/${activity.contact_id}` : null
                const body = (
                  <div className="px-5 py-3">
                    <p className="flex flex-wrap items-baseline gap-x-1.5 text-xs">
                      <span className="font-semibold text-ink">{activityTypeLabels[activity.activity_type]}</span>
                      {activity.subject_name && <span className="text-muted">· {activity.subject_name}</span>}
                      <time className="ml-auto text-subtle" dateTime={activity.occurred_at} title={formatDateTime(activity.occurred_at)}>
                        {formatRelative(activity.occurred_at)}
                      </time>
                    </p>
                    <p className="mt-0.5 line-clamp-2 text-[13px] text-muted">{activity.description}</p>
                  </div>
                )
                return <li key={activity.id}>{href ? <Link to={href} className="block transition-colors hover:bg-hover">{body}</Link> : body}</li>
              })}
            </ul>
          ) : (
            <EmptyState compact icon={<History />} title="Nenhuma atividade ainda" description="Ligações, anotações, visitas e mudanças de etapa aparecerão aqui." />
          )}
        </Panel>
      </div>

      <p className="flex items-center gap-1.5 text-xs text-subtle">
        <ContactRound className="size-3.5" aria-hidden="true" />
        Os indicadores consideram etapas configuradas como “em negociação” e “concluído (ganho)” nos funis.
      </p>
    </div>
  )
}
