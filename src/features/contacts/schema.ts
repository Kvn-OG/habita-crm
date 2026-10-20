import { normalizePhone } from '@/lib/format'
import { nullIfBlank } from '@/lib/utils'
import { email, optionalText, phone, requiredText, z } from '@/lib/validations'
import { CONTACT_TYPES } from '@/types/domain'
import type { Contact } from './types'

export const contactSchema = z
  .object({
    full_name: requiredText('o nome completo', 2, 160),
    phone: phone(true),
    whatsapp_same: z.boolean(),
    whatsapp: phone(false),
    email,
    contact_type: z.enum(CONTACT_TYPES, { error: 'Selecione o tipo de contato.' }),
    notes: optionalText(5000, 'As observações'),
  })
  .superRefine((values, ctx) => {
    if (!values.whatsapp_same && values.whatsapp.trim() === '') {
      ctx.addIssue({ code: 'custom', path: ['whatsapp'], message: 'Informe o WhatsApp ou marque que é o mesmo número.' })
    }
  })

export type ContactFormValues = z.infer<typeof contactSchema>

export const emptyContactValues: ContactFormValues = {
  full_name: '',
  phone: '',
  whatsapp_same: true,
  whatsapp: '',
  email: '',
  contact_type: 'comprador',
  notes: '',
}

export function contactToFormValues(contact: Contact): ContactFormValues {
  return {
    full_name: contact.full_name,
    phone: contact.phone,
    whatsapp_same: !contact.whatsapp,
    whatsapp: contact.whatsapp ?? '',
    email: contact.email ?? '',
    contact_type: contact.contact_type,
    notes: contact.notes ?? '',
  }
}

export function toContactPayload(values: ContactFormValues) {
  const phoneDigits = normalizePhone(values.phone)
  const whatsappDigits = values.whatsapp_same ? '' : normalizePhone(values.whatsapp)
  return {
    full_name: values.full_name.trim(),
    phone: phoneDigits,
    whatsapp: whatsappDigits && whatsappDigits !== phoneDigits ? whatsappDigits : null,
    email: nullIfBlank(values.email.toLowerCase()),
    contact_type: values.contact_type,
    notes: nullIfBlank(values.notes),
  }
}
