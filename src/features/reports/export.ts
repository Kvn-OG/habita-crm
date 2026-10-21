import { leadSourceLabels, pipelineLabels } from '@/lib/labels'
import type { ReportData } from './api'
import { aggregateSources, monthlySeries, percent, reportSummary, type Period } from './utils'

type Cell = string | number | null | undefined

/** Número no padrão brasileiro, sem separador de milhar (planilhas reconhecem como número). */
function numberCell(value: number) {
  return String(Math.round(value * 100) / 100).replace('.', ',')
}

function escapeCell(cell: Cell) {
  if (cell === null || cell === undefined) return ''
  const text = typeof cell === 'number' ? numberCell(cell) : cell
  return /[";\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

/** CSV separado por ponto e vírgula (padrão do Excel em português). */
export function toCsv(rows: Cell[][]) {
  return rows.map((row) => row.map(escapeCell).join(';')).join('\r\n')
}

export function buildReportRows(data: ReportData, period: Period, scope: string): Cell[][] {
  const summary = reportSummary(data)
  const pct = (value: number | null) => (value === null ? null : Math.round(value * 10) / 10)
  const rows: Cell[][] = [
    ['Relatório comercial'],
    ['Período', period.label],
    ['Funil', scope],
    [],
    ['Resumo'],
    ['Leads recebidos', summary.leads],
    ['Leads concluídos (ganhos)', summary.leadsWon],
    ['Conversão de leads (%)', pct(summary.leadConversion)],
    ['Negociações ganhas', data.deals.won_count],
    ['Valor das negociações ganhas (R$)', Number(data.deals.won_amount)],
    ['Negociações perdidas', data.deals.lost_count],
    ['Negociações canceladas', data.deals.cancelled_count],
    ['Taxa de sucesso das negociações (%)', pct(summary.dealSuccess)],
    ['Tempo médio até o fechamento (dias)', data.deals.avg_days_to_close === null ? null : Number(data.deals.avg_days_to_close)],
    ['Negociações em andamento (hoje)', data.deals.open_count],
    ['Valor em negociação (hoje, R$)', Number(data.deals.open_amount)],
    [],
    ['Funil de conversão'],
    ['Funil', 'Etapa', 'Leads que chegaram à etapa', '% do total'],
  ]

  for (const pipeline of ['venda', 'locacao'] as const) {
    const stages = data.funnel.filter((row) => row.pipeline === pipeline)
    const first = stages[0]?.total ?? 0
    for (const stage of stages) rows.push([pipelineLabels[pipeline], stage.name, stage.total, pct(percent(stage.total, first))])
  }

  rows.push([], ['Leads por origem'], ['Origem', 'Leads', 'Concluídos', 'Perdidos', 'Conversão (%)'])
  for (const source of aggregateSources(data.sources)) {
    rows.push([leadSourceLabels[source.source], source.total, source.won, source.lost, pct(percent(source.won, source.total))])
  }

  rows.push([], ['Desempenho por corretor'], ['Corretor', 'Leads recebidos', 'Visitas realizadas', 'Negociações em andamento', 'Fechamentos', 'Valor fechado (R$)'])
  for (const broker of data.brokers) {
    rows.push([broker.full_name || 'Sem nome', broker.leads, broker.visits, broker.deals_open, broker.deals_won, Number(broker.won_amount)])
  }

  rows.push([], ['Tempo médio por etapa'], ['Funil', 'Etapa', 'Média (dias)', 'Passagens consideradas'])
  for (const stage of data.stage_times) rows.push([pipelineLabels[stage.pipeline], stage.name, Number(stage.avg_days), stage.samples])

  rows.push([], ['Motivos de perda das negociações'], ['Motivo', 'Negociações'])
  for (const reason of data.loss_reasons) rows.push([reason.reason, reason.total])

  rows.push([], ['Fechamentos por mês'], ['Mês', 'Negociações ganhas', 'Valor (R$)'])
  for (const month of monthlySeries(data.monthly, period)) rows.push([month.month, month.total, month.amount])

  return rows
}

export function downloadCsv(filename: string, content: string) {
  // BOM para o Excel reconhecer os acentos (UTF-8).
  const blob = new Blob(['﻿', content], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.append(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
