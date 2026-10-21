import { area, money, optionalText, quantity, requiredText, uf, z } from '@/lib/validations'
import { nullIfBlank } from '@/lib/utils'
import { PROPERTY_PURPOSES, PROPERTY_STATUSES, PROPERTY_TYPES, type PropertyType } from '@/types/domain'
import type { Property } from './types'

export const propertySchema = z
  .object({
    title: requiredText('o título', 3, 160),
    property_type: z
      .string()
      .refine((value) => (PROPERTY_TYPES as readonly string[]).includes(value), 'Selecione o tipo do imóvel.'),
    purpose: z.enum(PROPERTY_PURPOSES, { error: 'Selecione a finalidade.' }),
    status: z.enum(PROPERTY_STATUSES, { error: 'Selecione a situação comercial.' }),
    description: optionalText(10000, 'A descrição'),

    state: uf,
    city: optionalText(120, 'A cidade'),
    neighborhood: optionalText(120, 'O bairro'),

    land_area: area('A área do terreno'),
    built_area: area('A área construída'),
    bedrooms: quantity('O número de quartos'),
    suites: quantity('O número de suítes'),
    bathrooms: quantity('O número de banheiros'),
    parking_spaces: quantity('O número de vagas'),

    sale_price: money('O valor de venda'),
    rent_price: money('O valor do aluguel'),
    condo_fee: money('O condomínio'),
    iptu: money('O IPTU'),
  })
  .superRefine((values, ctx) => {
    if (values.purpose !== 'locacao' && values.sale_price === null) {
      ctx.addIssue({ code: 'custom', path: ['sale_price'], message: 'Informe o valor de venda.' })
    }
    if (values.purpose !== 'venda' && values.rent_price === null) {
      ctx.addIssue({ code: 'custom', path: ['rent_price'], message: 'Informe o valor do aluguel.' })
    }
    if (values.suites !== null && values.bedrooms !== null && values.suites > values.bedrooms) {
      ctx.addIssue({ code: 'custom', path: ['suites'], message: 'O número de suítes não pode ser maior que o de quartos.' })
    }
  })

export type PropertyFormValues = z.infer<typeof propertySchema>

export const emptyPropertyValues: PropertyFormValues = {
  title: '',
  property_type: '',
  purpose: 'venda',
  status: 'disponivel',
  description: '',
  state: '',
  city: '',
  neighborhood: '',
  land_area: null,
  built_area: null,
  bedrooms: null,
  suites: null,
  bathrooms: null,
  parking_spaces: null,
  sale_price: null,
  rent_price: null,
  condo_fee: null,
  iptu: null,
}

export function propertyToFormValues(property: Property): PropertyFormValues {
  return {
    title: property.title,
    property_type: property.property_type,
    purpose: property.purpose,
    status: property.status,
    description: property.description ?? '',
    state: property.state ?? '',
    city: property.city ?? '',
    neighborhood: property.neighborhood ?? '',
    land_area: toNumberOrNull(property.land_area),
    built_area: toNumberOrNull(property.built_area),
    bedrooms: property.bedrooms,
    suites: property.suites,
    bathrooms: property.bathrooms,
    parking_spaces: property.parking_spaces,
    sale_price: toNumberOrNull(property.sale_price),
    rent_price: toNumberOrNull(property.rent_price),
    condo_fee: toNumberOrNull(property.condo_fee),
    iptu: toNumberOrNull(property.iptu),
  }
}

/** numeric do Postgres pode chegar como string pelo PostgREST. */
function toNumberOrNull(value: number | string | null) {
  if (value === null || value === undefined) return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

/**
 * Converte os valores do formulário no payload da tabela properties.
 * O código é gerado pelo banco e nunca é enviado.
 */
export function toPropertyPayload(values: PropertyFormValues) {
  return {
    title: values.title.trim(),
    property_type: values.property_type as PropertyType,
    purpose: values.purpose,
    status: values.status,
    description: nullIfBlank(values.description),
    state: nullIfBlank(values.state.toUpperCase()),
    city: nullIfBlank(values.city),
    neighborhood: nullIfBlank(values.neighborhood),
    land_area: values.land_area,
    built_area: values.built_area,
    bedrooms: values.bedrooms,
    suites: values.suites,
    bathrooms: values.bathrooms,
    parking_spaces: values.parking_spaces,
    // Valores que não se aplicam à finalidade escolhida são descartados.
    sale_price: values.purpose === 'locacao' ? null : values.sale_price,
    rent_price: values.purpose === 'venda' ? null : values.rent_price,
    condo_fee: values.condo_fee,
    iptu: values.iptu,
  }
}
