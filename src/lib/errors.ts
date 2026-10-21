import { SupabaseNotConfiguredError } from './supabase'

type PostgrestLikeError = {
  code?: string
  message?: string
  details?: string | null
  hint?: string | null
  status?: number
}

function isPostgrestLike(error: unknown): error is PostgrestLikeError {
  return typeof error === 'object' && error !== null && ('code' in error || 'message' in error)
}

/** Erro de sessão inválida/expirada retornado pelo PostgREST ou Storage. */
export function isAuthError(error: unknown) {
  if (!isPostgrestLike(error)) return false
  return (
    error.code === 'PGRST301' ||
    error.code === 'PGRST303' ||
    error.status === 401 ||
    /jwt expired|invalid jwt|jwt.*invalid/i.test(error.message ?? '')
  )
}

const constraintMessages: Record<string, string> = {
  contacts_phone_key: 'Já existe um contato com este telefone. Se ele não aparece para você, pode ter sido cadastrado por outro corretor: fale com o administrador.',
  contacts_email_key: 'Já existe um contato com este e-mail. Se ele não aparece para você, pode ter sido cadastrado por outro corretor: fale com o administrador.',
  properties_code_key: 'Não foi possível gerar o código do imóvel. Tente salvar novamente.',
  properties_sale_price_required: 'Informe o valor de venda para imóveis à venda.',
  properties_rent_price_required: 'Informe o valor do aluguel para imóveis para locação.',
  properties_suites_le_bedrooms: 'O número de suítes não pode ser maior que o de quartos.',
  leads_budget_range: 'O orçamento mínimo não pode ser maior que o máximo.',
  leads_contact_id_fkey: 'Este contato possui leads vinculados e não pode ser excluído.',
  owners_contact_id_fkey: 'Este contato é proprietário de imóveis e não pode ser excluído.',
  deals_lead_id_fkey: 'Este lead possui negociações vinculadas e não pode ser excluído.',
  leads_stage_id_fkey: 'Esta etapa possui leads vinculados e não pode ser excluída.',
  pipeline_stages_name_key: 'Já existe uma etapa com este nome neste funil.',
  proposals_one_accepted_idx: 'Esta negociação já tem uma proposta aceita. Altere a situação dela antes de aceitar outra.',
  deals_loss_reason_length: 'O motivo da perda deve ter no máximo 300 caracteres.',
}

/** Converte erros do Supabase/PostgREST em mensagens claras em português. */
export function getErrorMessage(error: unknown, fallback = 'Não foi possível concluir a operação.'): string {
  if (error instanceof SupabaseNotConfiguredError) return error.message
  if (error instanceof TypeError && /fetch/i.test(error.message)) {
    return 'Falha de conexão. Verifique sua internet e tente novamente.'
  }
  if (!isPostgrestLike(error)) return error instanceof Error ? error.message : fallback

  if (isAuthError(error)) return 'Sua sessão expirou. Entre novamente para continuar.'

  const text = `${error.message ?? ''} ${error.details ?? ''}`
  const constraint = Object.keys(constraintMessages).find((name) => text.includes(name))
  if (constraint) return constraintMessages[constraint] as string

  switch (error.code) {
    case '23505':
      return 'Já existe um registro com estas informações.'
    case '23503':
      return 'Este registro está vinculado a outros dados e não pode ser alterado ou excluído.'
    case '23514':
      // Mensagens de triggers do banco já estão em português.
      return error.message && !/violates check constraint/i.test(error.message)
        ? error.message
        : 'Alguns dados não atendem às regras de validação.'
    case '42501':
      return error.message && !/row-level security|permission denied/i.test(error.message)
        ? error.message
        : 'Você não tem permissão para realizar esta ação.'
    case 'PGRST116':
      return 'Registro não encontrado ou sem permissão de acesso.'
    default:
      break
  }

  if (/row-level security|permission denied/i.test(error.message ?? '')) {
    return 'Você não tem permissão para realizar esta ação.'
  }
  if (/failed to fetch|network/i.test(error.message ?? '')) {
    return 'Falha de conexão. Verifique sua internet e tente novamente.'
  }
  return error.message || fallback
}
