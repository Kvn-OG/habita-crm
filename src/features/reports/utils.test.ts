import { describe, expect, it } from 'vitest'
import { lossReasonText } from '@/features/deals/schema'
import type { ReportData } from './api'
import { buildReportRows, toCsv } from './export'
import { aggregateSources, formatDays, formatPercent, monthlySeries, monthsInPeriod, parseDateInput, percent, resolvePeriod } from './utils'

const now = new Date(2026, 9, 21, 15, 30) // 21/10/2026 15:30 (horário local)

describe('períodos dos relatórios', () => {
  it('últimos 90 dias é o padrão e inclui o dia de hoje', () => {
    const period = resolvePeriod('', '', '', now)
    expect(period.from).toEqual(new Date(2026, 6, 24))
    expect(period.to).toEqual(new Date(2026, 9, 22))
    expect(period.label).toBe('24/07/2026 a 21/10/2026')
  })
  it('mês passado termina no primeiro dia do mês atual', () => {
    const period = resolvePeriod('mes-anterior', '', '', now)
    expect(period.from).toEqual(new Date(2026, 8, 1))
    expect(period.to).toEqual(new Date(2026, 9, 1))
    expect(period.label).toBe('01/09/2026 a 30/09/2026')
  })
  it('período personalizado aceita datas invertidas', () => {
    const period = resolvePeriod('personalizado', '2026-10-10', '2026-10-01', now)
    expect(period.from).toEqual(new Date(2026, 9, 1))
    expect(period.to).toEqual(new Date(2026, 9, 11))
  })
  it('rejeita datas inexistentes', () => {
    expect(parseDateInput('2026-02-30')).toBeNull()
    expect(parseDateInput('21/10/2026')).toBeNull()
  })
  it('lista os meses do período', () => {
    expect(monthsInPeriod(resolvePeriod('ano', '', '', now))).toHaveLength(10)
    expect(monthsInPeriod(resolvePeriod('mes-anterior', '', '', now))).toEqual(['2026-09'])
  })
})

describe('consolidação', () => {
  it('soma as origens dos dois funis', () => {
    const rows = aggregateSources([
      { pipeline: 'venda', source: 'site', total: 3, won: 1, lost: 0 },
      { pipeline: 'locacao', source: 'site', total: 2, won: 1, lost: 1 },
      { pipeline: 'venda', source: 'instagram', total: 4, won: 0, lost: 2 },
    ])
    expect(rows).toEqual([
      { source: 'site', total: 5, won: 2, lost: 1 },
      { source: 'instagram', total: 4, won: 0, lost: 2 },
    ])
  })
  it('preenche meses sem fechamento com zero', () => {
    const series = monthlySeries(
      [{ month: '2026-09', pipeline: 'venda', total: 2, amount: 500000 }, { month: '2026-09', pipeline: 'locacao', total: 1, amount: 3000 }],
      { from: new Date(2026, 7, 15), to: new Date(2026, 9, 22) },
    )
    expect(series.map((row) => [row.month, row.total, row.amount])).toEqual([
      ['2026-08', 0, 0],
      ['2026-09', 3, 503000],
      ['2026-10', 0, 0],
    ])
  })
  it('formata percentuais e dias', () => {
    expect(percent(1, 0)).toBeNull()
    expect(formatPercent(percent(1, 3))).toBe('33%')
    expect(formatPercent(percent(1, 40))).toBe('2,5%')
    expect(formatDays(0.2)).toBe('menos de 1 dia')
    expect(formatDays(1)).toBe('1 dia')
    expect(formatDays(12.4)).toBe('12 dias')
  })
})

describe('exportação em planilha', () => {
  it('usa ponto e vírgula, vírgula decimal e aspas quando necessário', () => {
    expect(toCsv([['Motivo; detalhe', 'Diz "não"', 1234.5, null]])).toBe('"Motivo; detalhe";"Diz ""não""";1234,5;')
  })
  it('monta todas as seções do relatório', () => {
    const data: ReportData = {
      funnel: [
        { pipeline: 'venda', name: 'Novo lead', position: 1, category: 'aberto', total: 4 },
        { pipeline: 'venda', name: 'Fechado', position: 8, category: 'ganho', total: 1 },
      ],
      sources: [{ pipeline: 'venda', source: 'site', total: 4, won: 1, lost: 1 }],
      stage_times: [{ pipeline: 'venda', name: 'Novo lead', position: 1, avg_days: 2.5, samples: 3 }],
      brokers: [{ id: '1', full_name: 'Ana', leads: 4, leads_won: 1, leads_lost: 1, leads_open: 2, visits: 2, deals_open: 1, deals_won: 1, won_amount: 350000 }],
      deals: { open_count: 1, open_amount: 200000, won_count: 1, won_amount: 350000, lost_count: 1, cancelled_count: 0, avg_days_to_close: 12 },
      monthly: [{ month: '2026-10', pipeline: 'venda', total: 1, amount: 350000 }],
      loss_reasons: [{ reason: 'Preço acima do orçamento', total: 1 }],
    }
    const csv = toCsv(buildReportRows(data, resolvePeriod('mes', '', '', now), 'Venda'))
    expect(csv).toContain('Conversão de leads (%);25')
    expect(csv).toContain('Taxa de sucesso das negociações (%);50')
    expect(csv).toContain('Venda;Fechado;1;25')
    expect(csv).toContain('Ana;4;1;1;2;25;2;1;1;350000')
    expect(csv).toContain('Preço acima do orçamento;1')
    expect(csv).toContain('2026-10;1;350000')
  })
})

describe('motivo da perda', () => {
  it('combina o motivo sugerido com os detalhes', () => {
    expect(lossReasonText({ reason: 'Sem retorno do cliente', details: '' })).toBe('Sem retorno do cliente')
    expect(lossReasonText({ reason: 'Fechou com outro imóvel', details: ' no mesmo bairro ' })).toBe('Fechou com outro imóvel (no mesmo bairro)')
    expect(lossReasonText({ reason: 'outro', details: ' Mudou de cidade ' })).toBe('Mudou de cidade')
  })
})
