import { z } from 'zod'
import { normalizePhone } from '../format'

// Mensagens padrão do Zod em português do Brasil.
z.config(z.locales.ptBR())

/** Texto opcional: aceita string vazia. */
export const optionalText = (max: number, label = 'Este campo') =>
  z.string().trim().max(max, `${label} deve ter no máximo ${max} caracteres.`)

export const requiredText = (label: string, min = 2, max = 160) =>
  z
    .string()
    .trim()
    .min(1, `Informe ${label}.`)
    .min(min, `${capitalize(label)} deve ter pelo menos ${min} caracteres.`)
    .max(max, `${capitalize(label)} deve ter no máximo ${max} caracteres.`)

function capitalize(text: string) {
  const clean = text.replace(/^(o|a|os|as) /, '')
  return clean.charAt(0).toUpperCase() + clean.slice(1)
}

/** Valor monetário em reais (number | null). */
export const money = (label = 'O valor') =>
  z
    .number({ error: `${label} deve ser um número válido.` })
    .min(0, `${label} não pode ser negativo.`)
    .max(999_999_999_999.99, `${label} é muito alto.`)
    .nullable()

/** Área em m² (number | null). */
export const area = (label = 'A área') =>
  z
    .number({ error: `${label} deve ser um número válido. Use vírgula para decimais.` })
    .min(0, `${label} não pode ser negativa.`)
    .max(9_999_999_999.99, `${label} é muito alta.`)
    .nullable()

/** Quantidade inteira (number | null). */
export const quantity = (label = 'A quantidade') =>
  z
    .number({ error: `${label} deve ser um número inteiro.` })
    .int(`${label} deve ser um número inteiro.`)
    .min(0, `${label} não pode ser negativa.`)
    .max(99, `${label} deve ser no máximo 99.`)
    .nullable()

export const phone = (required: boolean) =>
  z
    .string()
    .trim()
    .refine((value) => (required ? value !== '' : true), 'Informe o telefone.')
    .refine((value) => {
      if (value === '') return true
      const digits = normalizePhone(value)
      return digits.length === 10 || digits.length === 11
    }, 'Informe um telefone válido com DDD, por exemplo (11) 99999-9999.')

export const email = z
  .string()
  .trim()
  .max(160, 'O e-mail deve ter no máximo 160 caracteres.')
  .refine((value) => value === '' || z.email().safeParse(value).success, 'Informe um e-mail válido.')

export const cep = z
  .string()
  .trim()
  .refine((value) => value === '' || /^\d{5}-?\d{3}$/.test(value), 'Informe um CEP válido, por exemplo 29140-000.')

export const uf = z
  .string()
  .trim()
  .refine((value) => value === '' || /^[A-Za-z]{2}$/.test(value), 'Use a sigla do estado com duas letras.')

export const uuid = (message: string) => z.string().uuid(message)
export const optionalUuid = z.string().refine((value) => value === '' || z.uuid().safeParse(value).success, 'Seleção inválida.')

export { z }
