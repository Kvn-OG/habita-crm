import { keepPreviousData, useQuery } from '@tanstack/react-query'
import {
  ChartColumn, Clock, Download, Handshake, Target, Trophy, UsersRound, Wallet, type LucideIcon,
} from 'lucide-react'
import { lazy, Suspense, useMemo, type ReactNode } from 'react'
import { useAuth } from '@/auth/AuthContext'
import { EmptyState } from '@/components/feedback/EmptyState'
import { ErrorState } from '@/components/feedback/ErrorState'
import { Input } from '@/components/forms/inputs'
import { FilterSelect } from '@/components/forms/SearchInput'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/Button'
import { Card, CardHeader } from '@/components/ui/Card'
import { Skeleton, Spinner } from '@/components/ui/Feedback'
import { SegmentedControl } from '@/components/ui/SegmentedControl'
import { useListParams } from '@/hooks/useListParams'
import { formatCompactCurrency, formatCurrency, formatNumber } from '@/lib/format'
import { leadSourceLabels, pipelineLabels } from '@/lib/labels'
import { cn } from '@/lib/utils'
import type { Pipeline } from '@/types/domain'
import { fetchReport, reportKeys, type ReportData } from './api'
import { buildReportRows, downloadCsv, toCsv } from './export'
import {
  aggregateSources, DEFAULT_PERIOD, formatDays, formatPercent, monthlySeries, percent, periodOptions, reportSummary,
  resolvePeriod, toDateInput,
} from './utils'

const WonByMonthChart = lazy(() => import('./components/WonByMonthChart'))

const FILTER_KEYS = ['periodo', 'de', 'ate', 'funil'] as const

// ---------------------------------------------------------------------------
// Blocos visuais
// ---------------------------------------------------------------------------

function KpiCard({ label, value, detail, icon: Icon, loading }: { label: string; value: string; detail?: string; icon: LucideIcon; loading: boolean }) {
  return (
    <div className="flex flex-col rounded-lg border border-line bg-surface p-4 shadow-card">
      <div className="flex items-start justify-between gap-2">
        <p className="min-h-[2.6em] text-[13px] leading-snug font-medium text-muted">{label}</p>
        <span className="grid size-8 shrink-0 place-items-center rounded-md bg-brand-50 text-brand-800 [&_svg]:size-4" aria-hidden="true">
          <Icon />
        </span>
      </div>
      {loading ? (
        <Skeleton className="mt-3 h-7 w-20" />
      ) : (
        <p className="mt-2 text-2xl leading-none font-semibold tracking-tight text-ink tabular">{value}</p>
      )}
      <p className="mt-2 min-h-4 text-xs text-subtle">{loading ? '' : detail}</p>
    </div>
  )
}

function Section({ title, description, children, className }: { title: string; description?: string; children: ReactNode; className?: string }) {
  return (
    <Card className={cn('flex flex-col', className)}>
      <CardHeader title={title} description={description} />
      <div className="flex-1">{children}</div>
    </Card>
  )
}

/** Barra horizontal proporcional ao maior valor da lista. */
function Meter({ value, max, className }: { value: number; max: number; className?: string }) {
  const width = max > 0 ? Math.max(value > 0 ? 2 : 0, (value / max) * 100) : 0
  return (
    <div className={cn('h-2 overflow-hidden rounded-full bg-line/70', className)} aria-hidden="true">
      <div className="h-full rounded-full bg-chart-1" style={{ width: `${width}%` }} />
    </div>
  )
}

function NoData({ text }: { text: string }) {
  return <EmptyState compact icon={<ChartColumn />} title="Sem dados no período" description={text} />
}

// ---------------------------------------------------------------------------
// Seções
// ---------------------------------------------------------------------------

function Funnel({ data, pipelines }: { data: ReportData; pipelines: Pipeline[] }) {
  const groups = pipelines
    .map((pipeline) => ({ pipeline, stages: data.funnel.filter((row) => row.pipeline === pipeline) }))
    .filter((group) => group.stages.length > 0 && (group.stages[0]?.total ?? 0) > 0)
  if (groups.length === 0) return <NoData text="Nenhum lead foi recebido no período selecionado." />

  return (
    <div className="space-y-6 p-5">
      {groups.map(({ pipeline, stages }) => {
        const first = stages[0]?.total ?? 0
        return (
          <div key={pipeline}>
            {pipelines.length > 1 && <h3 className="mb-3 text-xs font-semibold tracking-wide text-muted uppercase">{pipelineLabels[pipeline]}</h3>}
            <ol className="space-y-2.5">
              {stages.map((stage) => (
                <li key={stage.name} className="grid grid-cols-[minmax(0,9rem)_1fr_auto] items-center gap-3 text-[13px]">
                  <span className="truncate text-ink" title={stage.name}>
                    {stage.name}
                  </span>
                  <Meter value={stage.total} max={first} />
                  <span className="w-24 text-right text-xs text-muted tabular">
                    <span className="font-medium text-ink">{formatNumber(stage.total)}</span> · {formatPercent(percent(stage.total, first))}
                  </span>
                </li>
              ))}
            </ol>
          </div>
        )
      })}
    </div>
  )
}

function Sources({ data }: { data: ReportData }) {
  const rows = aggregateSources(data.sources)
  if (rows.length === 0) return <NoData text="Nenhum lead foi recebido no período selecionado." />
  const max = rows[0]?.total ?? 0
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-[13px]">
        <caption className="sr-only">Leads por origem</caption>
        <thead>
          <tr className="border-b border-line bg-canvas/70 text-xs text-muted">
            <th scope="col" className="h-9 px-5 font-medium">Origem</th>
            <th scope="col" className="h-9 px-3 text-right font-medium">Leads</th>
            <th scope="col" className="h-9 px-3 text-right font-medium">Concluídos</th>
            <th scope="col" className="h-9 px-5 text-right font-medium">Conversão</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {rows.map((row) => (
            <tr key={row.source}>
              <td className="px-5 py-2.5">
                <span className="block text-ink">{leadSourceLabels[row.source]}</span>
                <Meter value={row.total} max={max} className="mt-1.5 max-w-48" />
              </td>
              <td className="px-3 py-2.5 text-right tabular">{formatNumber(row.total)}</td>
              <td className="px-3 py-2.5 text-right tabular">{formatNumber(row.won)}</td>
              <td className="px-5 py-2.5 text-right font-medium tabular">{formatPercent(percent(row.won, row.total))}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function Brokers({ data }: { data: ReportData }) {
  if (data.brokers.length === 0) return <NoData text="Nenhum membro ativo na equipe." />
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] text-left text-[13px]">
        <caption className="sr-only">Desempenho por corretor</caption>
        <thead>
          <tr className="border-b border-line bg-canvas/70 text-xs text-muted">
            <th scope="col" className="h-9 px-5 font-medium">Corretor</th>
            <th scope="col" className="h-9 px-3 text-right font-medium">Leads recebidos</th>
            <th scope="col" className="h-9 px-3 text-right font-medium">Visitas realizadas</th>
            <th scope="col" className="h-9 px-3 text-right font-medium">Em negociação</th>
            <th scope="col" className="h-9 px-3 text-right font-medium">Fechamentos</th>
            <th scope="col" className="h-9 px-5 text-right font-medium">Valor fechado</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {data.brokers.map((broker) => (
            <tr key={broker.id}>
              <td className="px-5 py-2.5 font-medium text-ink">{broker.full_name || 'Sem nome'}</td>
              <td className="px-3 py-2.5 text-right tabular">{formatNumber(broker.leads)}</td>
              <td className="px-3 py-2.5 text-right tabular">{formatNumber(broker.visits)}</td>
              <td className="px-3 py-2.5 text-right tabular">{formatNumber(broker.deals_open)}</td>
              <td className="px-3 py-2.5 text-right tabular">{formatNumber(broker.deals_won)}</td>
              <td className="px-5 py-2.5 text-right font-medium tabular">{formatCurrency(broker.won_amount)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function StageTimes({ data, pipelines }: { data: ReportData; pipelines: Pipeline[] }) {
  if (data.stage_times.length === 0) return <NoData text="Nenhum lead mudou de etapa no período selecionado." />
  return (
    <div className="space-y-5 p-5">
      {pipelines.map((pipeline) => {
        const rows = data.stage_times.filter((row) => row.pipeline === pipeline)
        if (rows.length === 0) return null
        const max = Math.max(...rows.map((row) => Number(row.avg_days)))
        return (
          <div key={pipeline}>
            {pipelines.length > 1 && <h3 className="mb-3 text-xs font-semibold tracking-wide text-muted uppercase">{pipelineLabels[pipeline]}</h3>}
            <ul className="space-y-2.5">
              {rows.map((row) => (
                <li key={row.name} className="grid grid-cols-[minmax(0,9rem)_1fr_auto] items-center gap-3 text-[13px]">
                  <span className="truncate text-ink" title={`${row.name} · ${row.samples} passagem(ns)`}>
                    {row.name}
                  </span>
                  <Meter value={Number(row.avg_days)} max={max} />
                  <span className="w-24 text-right text-xs font-medium text-ink tabular">{formatDays(row.avg_days)}</span>
                </li>
              ))}
            </ul>
          </div>
        )
      })}
    </div>
  )
}

function LossReasons({ data }: { data: ReportData }) {
  if (data.loss_reasons.length === 0) return <NoData text="Nenhuma negociação foi perdida no período selecionado." />
  const max = data.loss_reasons[0]?.total ?? 0
  return (
    <ul className="space-y-3 p-5">
      {data.loss_reasons.map((row) => (
        <li key={row.reason} className="text-[13px]">
          <div className="flex items-baseline justify-between gap-3">
            <span className="min-w-0 text-ink">{row.reason}</span>
            <span className="shrink-0 text-xs font-medium text-ink tabular">{formatNumber(row.total)}</span>
          </div>
          <Meter value={row.total} max={max} className="mt-1.5" />
        </li>
      ))}
    </ul>
  )
}

// ---------------------------------------------------------------------------
// Página
// ---------------------------------------------------------------------------

export function ReportsPage() {
  const { profile } = useAuth()
  const { values, set } = useListParams(FILTER_KEYS)
  const preset = values.periodo || DEFAULT_PERIOD
  const pipeline: Pipeline | null = values.funil === 'venda' || values.funil === 'locacao' ? values.funil : null
  const period = useMemo(() => resolvePeriod(preset, values.de, values.ate), [preset, values.de, values.ate])
  const params = { from: period.from.toISOString(), to: period.to.toISOString(), pipeline }
  const pipelines: Pipeline[] = pipeline ? [pipeline] : ['venda', 'locacao']

  const query = useQuery({ queryKey: reportKeys.metrics(params), queryFn: () => fetchReport(params), placeholderData: keepPreviousData })
  const data = query.data
  const loading = query.isLoading
  const summary = data ? reportSummary(data) : null
  const months = data ? monthlySeries(data.monthly, period) : []
  const hasWins = months.some((row) => row.total > 0)

  const choosePeriod = (periodo: string) => {
    if (periodo === 'personalizado') {
      set({ periodo, de: values.de || toDateInput(period.from), ate: values.ate || toDateInput(new Date(period.to.getTime() - 1)) })
    } else set({ periodo: periodo || null, de: null, ate: null })
  }

  const exportCsv = () => {
    if (!data) return
    const scope = pipeline ? pipelineLabels[pipeline] : 'Venda e locação'
    const stamp = toDateInput(new Date())
    downloadCsv(`relatorio-habita-${stamp}.csv`, toCsv(buildReportRows(data, period, scope)))
  }

  return (
    <>
      <PageHeader
        description="Indicadores calculados a partir dos leads, visitas e negociações registrados no CRM."
        actions={
          <Button variant="secondary" icon={<Download />} onClick={exportCsv} disabled={!data}>
            Exportar planilha
          </Button>
        }
      />

      <Card className="mb-5">
        <div className="flex flex-col gap-3 p-4 lg:flex-row lg:items-center">
          <div className="grid grid-cols-1 gap-2 sm:flex sm:flex-wrap sm:items-center">
            <FilterSelect label="Período" allLabel="Últimos 90 dias" value={values.periodo} onChange={choosePeriod} options={periodOptions} />
            {preset === 'personalizado' && (
              <div className="flex items-center gap-2">
                <Input type="date" aria-label="Data inicial" value={values.de} max={values.ate || undefined} onChange={(event) => set({ de: event.target.value })} />
                <span className="text-xs text-muted">até</span>
                <Input type="date" aria-label="Data final" value={values.ate} min={values.de || undefined} onChange={(event) => set({ ate: event.target.value })} />
              </div>
            )}
            <p className="text-xs text-muted tabular sm:ml-1">{period.label}</p>
          </div>
          <SegmentedControl
            label="Funil"
            className="lg:ml-auto"
            value={pipeline ?? 'todos'}
            onChange={(funil) => set({ funil: funil === 'todos' ? null : funil })}
            options={[
              { value: 'todos', label: 'Todos' },
              { value: 'venda', label: 'Venda' },
              { value: 'locacao', label: 'Locação' },
            ]}
          />
        </div>
      </Card>

      {query.isError ? (
        <Card>
          <ErrorState error={query.error} title="Não foi possível carregar os relatórios" onRetry={() => void query.refetch()} />
        </Card>
      ) : (
        <div className={cn('space-y-5', query.isFetching && !loading && 'opacity-70 transition-opacity')}>
          <section aria-label="Resumo do período" className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
            <KpiCard label="Leads recebidos" icon={Target} loading={loading} value={formatNumber(summary?.leads ?? 0)} detail={summary ? `${formatNumber(summary.leadsWon)} concluído(s)` : undefined} />
            <KpiCard label="Conversão de leads" icon={UsersRound} loading={loading} value={formatPercent(summary?.leadConversion ?? null)} detail="Leads do período já concluídos" />
            <KpiCard label="Negociações ganhas" icon={Trophy} loading={loading} value={formatNumber(data?.deals.won_count ?? 0)} detail={data ? formatCurrency(data.deals.won_amount) : undefined} />
            <KpiCard
              label="Taxa de sucesso"
              icon={Handshake}
              loading={loading}
              value={formatPercent(summary?.dealSuccess ?? null)}
              detail={data ? `${formatNumber(data.deals.lost_count)} perdida(s)` : undefined}
            />
            <KpiCard label="Tempo médio até fechar" icon={Clock} loading={loading} value={formatDays(data?.deals.avg_days_to_close)} detail="Da abertura ao ganho" />
            <KpiCard
              label="Em negociação agora"
              icon={Wallet}
              loading={loading}
              value={formatCompactCurrency(data?.deals.open_amount ?? 0)}
              detail={data ? `${formatNumber(data.deals.open_count)} negociação(ões) abertas` : undefined}
            />
          </section>

          {loading || !data ? (
            <div className="grid gap-5 lg:grid-cols-2">
              <Skeleton className="h-72" />
              <Skeleton className="h-72" />
            </div>
          ) : (
            <>
              <div className="grid gap-5 lg:grid-cols-2">
                <Section title="Funil de conversão" description="Leads recebidos no período e até que etapa chegaram">
                  <Funnel data={data} pipelines={pipelines} />
                </Section>
                <Section title="Leads por origem" description="De onde vieram os leads e quantos foram concluídos">
                  <Sources data={data} />
                </Section>
              </div>

              <Section title="Fechamentos por mês" description="Valor das negociações ganhas em cada mês">
                {hasWins ? (
                  <div className="p-4">
                    <Suspense
                      fallback={
                        <div className="grid h-64 place-items-center">
                          <Spinner />
                        </div>
                      }
                    >
                      <WonByMonthChart rows={months} />
                    </Suspense>
                  </div>
                ) : (
                  <EmptyState compact icon={<Handshake />} title="Nenhuma negociação ganha no período" description="Os fechamentos aparecem aqui quando uma negociação é marcada como ganha." />
                )}
              </Section>

              <Section title="Desempenho por corretor" description="Leads e visitas do período, negociações abertas hoje e fechamentos do período">
                <Brokers data={data} />
              </Section>

              <div className="grid gap-5 lg:grid-cols-2">
                <Section title="Tempo médio em cada etapa" description="Quanto tempo os leads ficaram na etapa antes de avançar ou sair">
                  <StageTimes data={data} pipelines={pipelines} />
                </Section>
                <Section title="Motivos de perda" description="Negociações perdidas no período">
                  <LossReasons data={data} />
                </Section>
              </div>
            </>
          )}

          <p className="text-xs leading-relaxed text-subtle">
            O funil e o tempo por etapa usam o histórico de atividades dos leads: registros apagados do histórico deixam de ser considerados.
            {profile?.role === 'corretor' ? ' Os números consideram toda a equipe.' : ''}
          </p>
        </div>
      )}
    </>
  )
}
