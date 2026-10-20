import {
  Building2, CalendarDays, CalendarPlus, ChartColumn, Columns3, ContactRound, Handshake, House, KeyRound,
  LayoutDashboard, Settings, Target, UserPlus, UserRound, UsersRound, Workflow, type LucideIcon,
} from 'lucide-react'

export type CommandGroup = 'acao' | 'atalho' | 'pagina'

export type Command = {
  id: string
  label: string
  description: string
  to: string
  icon: LucideIcon
  group: CommandGroup
  /** Palavras usadas na pesquisa (sem acento, minúsculas). */
  keywords: string[]
  /** Pode ser escolhido como ação rápida no painel. */
  quick?: boolean
}

const CREATE = ['cadastrar', 'cadastro', 'novo', 'nova', 'adicionar', 'criar', 'incluir', 'registrar']

/** Catálogo único de ações e páginas: alimenta a pesquisa do cabeçalho e as ações rápidas. */
export const commands: Command[] = [
  { id: 'novo-imovel', group: 'acao', quick: true, label: 'Cadastrar imóvel', description: 'Novo imóvel na carteira', to: '/imoveis/novo', icon: Building2, keywords: [...CREATE, 'imovel', 'casa', 'apartamento', 'terreno'] },
  { id: 'novo-contato', group: 'acao', quick: true, label: 'Adicionar contato', description: 'Comprador, interessado ou proprietário', to: '/contatos?novo=1', icon: UserPlus, keywords: [...CREATE, 'contato', 'cliente', 'proprietario', 'comprador'] },
  { id: 'novo-lead', group: 'acao', quick: true, label: 'Criar lead', description: 'Nova oportunidade de venda ou locação', to: '/leads?novo=1', icon: Target, keywords: [...CREATE, 'lead', 'oportunidade', 'interessado'] },
  { id: 'agendar-visita', group: 'acao', quick: true, label: 'Agendar visita', description: 'Visita ou reunião na agenda', to: '/agenda?novo=1', icon: CalendarPlus, keywords: [...CREATE, 'agendar', 'visita', 'reuniao', 'compromisso', 'marcar'] },

  { id: 'funil-venda', group: 'atalho', quick: true, label: 'Funil de venda', description: 'Leads de venda por etapa', to: '/leads?visao=funil&funil=venda', icon: Columns3, keywords: ['funil', 'kanban', 'venda', 'vendas', 'leads', 'etapas'] },
  { id: 'funil-locacao', group: 'atalho', quick: true, label: 'Funil de locação', description: 'Leads de locação por etapa', to: '/leads?visao=funil&funil=locacao', icon: Columns3, keywords: ['funil', 'kanban', 'locacao', 'aluguel', 'leads', 'etapas'] },
  { id: 'meus-leads', group: 'atalho', quick: true, label: 'Meus leads', description: 'Leads sob sua responsabilidade', to: '/leads?responsavel=eu', icon: Target, keywords: ['meus', 'leads', 'responsavel', 'carteira'] },
  { id: 'imoveis-disponiveis', group: 'atalho', quick: true, label: 'Imóveis disponíveis', description: 'Carteira disponível para negócio', to: '/imoveis?situacao=disponivel', icon: House, keywords: ['imoveis', 'disponiveis', 'carteira', 'estoque'] },
  { id: 'imoveis-locacao', group: 'atalho', quick: true, label: 'Imóveis para locação', description: 'Carteira de aluguel', to: '/imoveis?finalidade=locacao', icon: KeyRound, keywords: ['imoveis', 'locacao', 'aluguel', 'alugar'] },
  { id: 'proximas-visitas', group: 'atalho', quick: true, label: 'Próximas visitas', description: 'Compromissos agendados', to: '/agenda', icon: CalendarDays, keywords: ['agenda', 'visitas', 'compromissos', 'proximas'] },
  { id: 'meu-perfil', group: 'atalho', label: 'Meu perfil', description: 'Dados pessoais e senha', to: '/configuracoes?aba=perfil', icon: UserRound, keywords: ['perfil', 'senha', 'alterar', 'conta', 'trocar'] },
  { id: 'equipe', group: 'atalho', label: 'Equipe e acessos', description: 'Liberar usuários e papéis', to: '/configuracoes?aba=equipe', icon: UsersRound, keywords: ['equipe', 'usuarios', 'acesso', 'liberar', 'corretores', 'permissoes'] },
  { id: 'config-funis', group: 'atalho', label: 'Configurar funis', description: 'Etapas de venda e locação', to: '/configuracoes?aba=funis', icon: Workflow, keywords: ['configurar', 'funis', 'etapas', 'pipeline'] },

  { id: 'pagina-visao-geral', group: 'pagina', label: 'Visão geral', description: 'Painel de indicadores', to: '/', icon: LayoutDashboard, keywords: ['inicio', 'painel', 'dashboard', 'visao', 'geral', 'home'] },
  { id: 'pagina-leads', group: 'pagina', label: 'Leads', description: 'Oportunidades comerciais', to: '/leads', icon: Target, keywords: ['leads', 'oportunidades'] },
  { id: 'pagina-imoveis', group: 'pagina', label: 'Imóveis', description: 'Carteira de imóveis', to: '/imoveis', icon: Building2, keywords: ['imoveis', 'carteira'] },
  { id: 'pagina-contatos', group: 'pagina', label: 'Contatos', description: 'Clientes e proprietários', to: '/contatos', icon: ContactRound, keywords: ['contatos', 'clientes'] },
  { id: 'pagina-agenda', group: 'pagina', label: 'Agenda', description: 'Visitas e reuniões', to: '/agenda', icon: CalendarDays, keywords: ['agenda', 'calendario'] },
  { id: 'pagina-negociacoes', group: 'pagina', label: 'Negociações', description: 'Em preparação', to: '/negociacoes', icon: Handshake, keywords: ['negociacoes', 'propostas'] },
  { id: 'pagina-relatorios', group: 'pagina', label: 'Relatórios', description: 'Em preparação', to: '/relatorios', icon: ChartColumn, keywords: ['relatorios', 'indicadores'] },
  { id: 'pagina-configuracoes', group: 'pagina', label: 'Configurações', description: 'Perfil, equipe e funis', to: '/configuracoes', icon: Settings, keywords: ['configuracoes', 'ajustes', 'preferencias'] },
]

export const DEFAULT_QUICK_ACTIONS = ['novo-imovel', 'novo-contato', 'novo-lead', 'agendar-visita']
export const MAX_QUICK_ACTIONS = 8

export const commandGroupLabels: Record<CommandGroup, string> = {
  acao: 'Ações',
  atalho: 'Atalhos',
  pagina: 'Páginas',
}

export function normalizeText(value: string) {
  return value.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()
}

/**
 * Encontra comandos cujo título ou palavras-chave começam com cada termo digitado
 * (sem diferenciar acentos). Ex.: "cadastrar" → todas as opções de cadastro.
 */
export function searchCommands(query: string, limit = 8): Command[] {
  const tokens = normalizeText(query).split(/\s+/).filter((token) => token.length >= 2)
  if (tokens.length === 0) return []

  const scored = commands
    .map((command) => {
      const labelWords = normalizeText(command.label).split(/\s+/)
      const words = [...labelWords, ...command.keywords]
      const matchesAll = tokens.every((token) => words.some((word) => word.startsWith(token)))
      if (!matchesAll) return null
      const labelHits = tokens.filter((token) => labelWords.some((word) => word.startsWith(token))).length
      const groupWeight = command.group === 'acao' ? 2 : command.group === 'atalho' ? 1 : 0
      return { command, score: labelHits * 10 + groupWeight }
    })
    .filter((item): item is { command: Command; score: number } => item !== null)
    .sort((a, b) => b.score - a.score)

  return scored.slice(0, limit).map((item) => item.command)
}

export function commandsByIds(ids: readonly string[]) {
  return ids.map((id) => commands.find((command) => command.id === id)).filter((command): command is Command => Boolean(command?.quick))
}
