import { describe, expect, it } from 'vitest'
import { commandsByIds, DEFAULT_QUICK_ACTIONS, searchCommands } from '@/app/commands'
import { isStageRegression, wasEdited } from '@/features/leads/activityRules'
import { nextPropertyCode } from '@/features/properties/api'
import type { PipelineStage } from '@/types/domain'

describe('pesquisa de comandos', () => {
  it('"cadastrar" lista as opções de cadastro', () => {
    const ids = searchCommands('Cadastrar').map((command) => command.id)
    expect(ids).toEqual(expect.arrayContaining(['novo-imovel', 'novo-contato', 'novo-lead', 'agendar-visita']))
  })
  it('ignora acentos e combina termos', () => {
    expect(searchCommands('imovel')[0]?.id).toBe('novo-imovel')
    expect(searchCommands('funil loca').map((command) => command.id)).toEqual(['funil-locacao'])
    expect(searchCommands('configuracoes').some((command) => command.id === 'pagina-configuracoes')).toBe(true)
  })
  it('não sugere nada para termos curtos ou sem relação', () => {
    expect(searchCommands('a')).toEqual([])
    expect(searchCommands('xyzabc')).toEqual([])
  })
  it('resolve ações rápidas válidas e descarta ids desconhecidos', () => {
    expect(commandsByIds(DEFAULT_QUICK_ACTIONS)).toHaveLength(4)
    expect(commandsByIds(['novo-lead', 'inexistente', 'pagina-leads']).map((command) => command.id)).toEqual(['novo-lead'])
  })
})

describe('código do imóvel', () => {
  it('sugere o próximo número sequencial', () => {
    expect(nextPropertyCode([])).toBe('IM-0001')
    expect(nextPropertyCode(['IM-0001', 'IM-0009', 'IM-0003'])).toBe('IM-0010')
    expect(nextPropertyCode(['IM-12', 'CASA-01', 'im-0005'])).toBe('IM-0013')
  })
})

describe('histórico de atividades', () => {
  const stages = [
    { id: 'novo', position: 1 },
    { id: 'proposta', position: 6 },
    { id: 'perdido', position: 9 },
  ] as PipelineStage[]
  const change = (from: string, to: string) => ({ activity_type: 'mudanca_etapa' as const, metadata: { from_stage_id: from, to_stage_id: to } })

  it('identifica retrocessos de etapa', () => {
    expect(isStageRegression(change('proposta', 'novo'), stages)).toBe(true)
    expect(isStageRegression(change('novo', 'proposta'), stages)).toBe(false)
    expect(isStageRegression(change('proposta', 'perdido'), stages)).toBe(false)
  })
  it('não afeta outros tipos de atividade', () => {
    expect(isStageRegression({ activity_type: 'nota', metadata: null }, stages)).toBe(false)
  })
  it('detecta comentários editados', () => {
    expect(wasEdited({ created_at: '2026-10-21T10:00:00Z', updated_at: '2026-10-21T10:00:00Z' })).toBe(false)
    expect(wasEdited({ created_at: '2026-10-21T10:00:00Z', updated_at: '2026-10-21T10:05:00Z' })).toBe(true)
  })
})
