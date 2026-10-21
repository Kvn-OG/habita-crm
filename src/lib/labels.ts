import type {
  ActivityType, AppRole, AppointmentStatus, AppointmentType, ContactType, DealStatus, LeadSource, Pipeline,
  PropertyPurpose, PropertyStatus, PropertyType, ProposalStatus, StageCategory,
} from '@/types/domain'

export const roleLabels: Record<AppRole, string> = {
  admin: 'Administrador',
  gestor: 'Gestor',
  corretor: 'Corretor',
}

export const contactTypeLabels: Record<ContactType, string> = {
  comprador: 'Comprador',
  interessado_locacao: 'Interessado em locação',
  proprietario: 'Proprietário',
  outro: 'Outro',
}

export const propertyTypeLabels: Record<PropertyType, string> = {
  apartamento: 'Apartamento',
  casa: 'Casa',
  casa_condominio: 'Casa em condomínio',
  cobertura: 'Cobertura',
  kitnet: 'Kitnet / studio',
  terreno: 'Terreno',
  sala_comercial: 'Sala comercial',
  loja: 'Loja',
  galpao: 'Galpão',
  sitio_chacara: 'Sítio / chácara',
  outro: 'Outro',
}

export const propertyPurposeLabels: Record<PropertyPurpose, string> = {
  venda: 'Venda',
  locacao: 'Locação',
  ambos: 'Venda e locação',
}

export const propertyStatusLabels: Record<PropertyStatus, string> = {
  disponivel: 'Disponível',
  reservado: 'Reservado',
  em_negociacao: 'Em negociação',
  vendido: 'Vendido',
  alugado: 'Alugado',
  indisponivel: 'Indisponível',
}

export const pipelineLabels: Record<Pipeline, string> = {
  venda: 'Venda',
  locacao: 'Locação',
}

export const stageCategoryLabels: Record<StageCategory, string> = {
  aberto: 'Em aberto',
  negociacao: 'Em negociação',
  ganho: 'Concluído (ganho)',
  perdido: 'Perdido',
}

export const leadSourceLabels: Record<LeadSource, string> = {
  site: 'Site',
  instagram: 'Instagram',
  whatsapp: 'WhatsApp',
  telefone: 'Telefone',
  indicacao: 'Indicação',
  portal: 'Portal imobiliário',
  outro: 'Outro',
}

export const activityTypeLabels: Record<ActivityType, string> = {
  nota: 'Anotação',
  ligacao: 'Ligação',
  whatsapp: 'WhatsApp',
  email: 'E-mail',
  visita: 'Visita',
  reuniao: 'Reunião',
  mudanca_etapa: 'Mudança de etapa',
  sistema: 'Registro do sistema',
}

export const appointmentTypeLabels: Record<AppointmentType, string> = {
  visita: 'Visita',
  reuniao: 'Reunião',
  outro: 'Outro compromisso',
}

export const appointmentStatusLabels: Record<AppointmentStatus, string> = {
  agendado: 'Agendado',
  realizado: 'Realizado',
  cancelado: 'Cancelado',
}

export const dealStatusLabels: Record<DealStatus, string> = {
  em_andamento: 'Em andamento',
  ganho: 'Ganha',
  perdido: 'Perdida',
  cancelado: 'Cancelada',
}

export const proposalStatusLabels: Record<ProposalStatus, string> = {
  rascunho: 'Rascunho',
  enviada: 'Enviada',
  aceita: 'Aceita',
  recusada: 'Recusada',
  cancelada: 'Cancelada',
}

/** Motivos de perda sugeridos (o texto escolhido é gravado na negociação). */
export const LOSS_REASONS = [
  'Preço acima do orçamento',
  'Financiamento ou crédito não aprovado',
  'Fechou com outro imóvel',
  'Fechou com outra imobiliária',
  'Desistiu da compra ou locação',
  'Imóvel deixou de estar disponível',
  'Sem retorno do cliente',
] as const

export function toOptions<T extends string>(labels: Record<T, string>, order?: readonly T[]) {
  const keys = order ?? (Object.keys(labels) as T[])
  return keys.map((value) => ({ value, label: labels[value] }))
}

export const BRAZILIAN_STATES = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA',
  'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO',
] as const
