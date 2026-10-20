/** Dados da marca do CRM (fonte única para nome e slogan). */
export const APP_NAME = 'Habita'
export const APP_SLOGAN = 'Sua imobiliária, mais organizada'

/**
 * Nome da imobiliária que usa esta instalação (opcional, por variável de ambiente).
 * Sem a variável, os textos ficam genéricos.
 */
export const AGENCY_NAME = import.meta.env.VITE_IMOBILIARIA_NOME?.trim() || null
