import { describe, expect, it } from 'vitest'
import { contactSchema, emptyContactValues, toContactPayload } from '@/features/contacts/schema'
import { leadSchema } from '@/features/leads/schema'
import { emptyPropertyValues, propertySchema, toPropertyPayload } from '@/features/properties/schema'
import { sanitizeSearchTerm } from './utils'

const validProperty = {
  ...emptyPropertyValues,
  title: 'Apartamento 2 quartos',
  property_type: 'apartamento',
  sale_price: 350000,
}

function messages(result: { success: boolean; error?: { issues: { path: PropertyKey[]; message: string }[] } }) {
  return Object.fromEntries((result.error?.issues ?? []).map((issue) => [issue.path.join('.'), issue.message]))
}

describe('imóvel', () => {
  it('aceita um cadastro mínimo válido e normaliza o payload', () => {
    const parsed = propertySchema.parse(validProperty)
    const payload = toPropertyPayload(parsed)
    expect(payload).not.toHaveProperty('code')
    expect(payload).not.toHaveProperty('street')
    expect(payload.sale_price).toBe(350000)
    expect(payload.rent_price).toBeNull()
    expect(payload.description).toBeNull()
  })

  it('exige o valor conforme a finalidade, com mensagem em português', () => {
    const errors = messages(propertySchema.safeParse({ ...validProperty, purpose: 'ambos', sale_price: null }))
    expect(errors.sale_price).toBe('Informe o valor de venda.')
    expect(errors.rent_price).toBe('Informe o valor do aluguel.')
  })

  it('valida tipo e suítes', () => {
    const errors = messages(
      propertySchema.safeParse({ ...validProperty, property_type: '', bedrooms: 1, suites: 2 }),
    )
    expect(errors.property_type).toBe('Selecione o tipo do imóvel.')
    expect(errors.suites).toMatch(/suítes não pode ser maior/)
  })

  it('rejeita números inválidos e negativos', () => {
    const errors = messages(propertySchema.safeParse({ ...validProperty, land_area: Number.NaN, condo_fee: -1, bathrooms: 1.5 }))
    expect(errors.land_area).toMatch(/número válido/)
    expect(errors.condo_fee).toMatch(/não pode ser negativo/)
    expect(errors.bathrooms).toMatch(/inteiro/)
  })

  it('descarta o valor que não se aplica à finalidade', () => {
    const payload = toPropertyPayload(propertySchema.parse({ ...validProperty, purpose: 'locacao', sale_price: 1, rent_price: 2500 }))
    expect(payload.sale_price).toBeNull()
    expect(payload.rent_price).toBe(2500)
  })
})

describe('contato', () => {
  it('valida telefone e e-mail', () => {
    const errors = messages(contactSchema.safeParse({ ...emptyContactValues, full_name: 'Ana', phone: '123', email: 'ana@' }))
    expect(errors.phone).toMatch(/telefone válido/)
    expect(errors.email).toBe('Informe um e-mail válido.')
  })

  it('exige o WhatsApp quando diferente do telefone', () => {
    const errors = messages(contactSchema.safeParse({ ...emptyContactValues, full_name: 'Ana', phone: '11999990001', whatsapp_same: false }))
    expect(errors.whatsapp).toMatch(/WhatsApp/)
  })

  it('normaliza o payload', () => {
    const payload = toContactPayload(
      contactSchema.parse({ ...emptyContactValues, full_name: ' Ana Souza ', phone: '(11) 99999-0001', email: 'ANA@Email.com', whatsapp_same: false, whatsapp: '(11) 99999-0001' }),
    )
    expect(payload).toMatchObject({ full_name: 'Ana Souza', phone: '11999990001', whatsapp: null, email: 'ana@email.com' })
  })
})

describe('lead', () => {
  const base = {
    contact_id: '9d6f3c1e-3b1a-4c55-9a52-1f2e3d4c5b6a',
    purpose: 'venda' as const,
    source: 'site' as const,
    stage_id: 'abc',
    assigned_to: '',
    min_budget: null,
    max_budget: null,
    desired_region: '',
    next_follow_up_at: '',
    notes: '',
  }

  it('exige contato e etapa', () => {
    const errors = messages(leadSchema.safeParse({ ...base, contact_id: '', stage_id: '' }))
    expect(errors.contact_id).toBe('Selecione o contato relacionado.')
    expect(errors.stage_id).toBe('Selecione a etapa comercial.')
  })

  it('valida a faixa de orçamento', () => {
    const errors = messages(leadSchema.safeParse({ ...base, min_budget: 500000, max_budget: 300000 }))
    expect(errors.max_budget).toMatch(/maior ou igual ao mínimo/)
  })
})

describe('busca', () => {
  it('remove caracteres especiais dos filtros do PostgREST', () => {
    expect(sanitizeSearchTerm('casa, (centro)*')).toBe('casa centro')
    expect(sanitizeSearchTerm('100%_off')).toBe('100 off')
  })
})
