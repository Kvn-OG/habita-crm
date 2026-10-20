import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowUpRight } from 'lucide-react'
import { useState } from 'react'
import { Controller, useForm, useWatch } from 'react-hook-form'
import { Link } from 'react-router-dom'
import { Alert } from '@/components/feedback/Alert'
import { useToast } from '@/components/feedback/Toast'
import { RequiredNote } from '@/components/forms/Field'
import { Checkbox, PhoneField, SelectField, TextareaField, TextField } from '@/components/forms/inputs'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { getErrorMessage } from '@/lib/errors'
import { formatPhone } from '@/lib/format'
import { contactTypeLabels, toOptions } from '@/lib/labels'
import type { ContactType } from '@/types/domain'
import { contactKeys, createContact, findDuplicateContacts, updateContact } from '../api'
import { contactSchema, contactToFormValues, emptyContactValues, type ContactFormValues } from '../schema'
import type { Contact, DuplicateMatch } from '../types'

type ContactFormModalProps = {
  open: boolean
  onClose: () => void
  contact?: Contact | null
  defaultType?: ContactType
  onSaved?: (contact: Contact) => void
}

export function ContactFormModal(props: ContactFormModalProps) {
  if (!props.open) return null
  return <ContactFormModalContent {...props} />
}

function ContactFormModalContent({ onClose, contact, defaultType, onSaved }: ContactFormModalProps) {
  const queryClient = useQueryClient()
  const toast = useToast()
  const [duplicates, setDuplicates] = useState<DuplicateMatch[]>([])
  const editing = Boolean(contact)

  const form = useForm<ContactFormValues>({
    resolver: zodResolver(contactSchema),
    defaultValues: contact ? contactToFormValues(contact) : { ...emptyContactValues, contact_type: defaultType ?? 'comprador' },
  })
  const { register, control, handleSubmit, getValues, formState: { errors } } = form
  const whatsappSame = useWatch({ control, name: 'whatsapp_same' })

  const save = useMutation({
    mutationFn: async (values: ContactFormValues) => {
      const matches = await findDuplicateContacts(values, contact?.id)
      if (matches.length) {
        setDuplicates(matches)
        return null
      }
      return contact ? updateContact(contact.id, values) : createContact(values)
    },
    onSuccess: async (saved) => {
      if (!saved) return
      await queryClient.invalidateQueries({ queryKey: contactKeys.all })
      toast.success(editing ? 'Contato atualizado.' : 'Contato cadastrado.', saved.full_name)
      onSaved?.(saved)
      onClose()
    },
    onError: (error) => toast.error('Não foi possível salvar o contato', getErrorMessage(error)),
  })

  // Verificação antecipada (não bloqueante) ao sair dos campos de telefone e e-mail.
  const checkEarly = async () => {
    try {
      setDuplicates(await findDuplicateContacts(getValues(), contact?.id))
    } catch {
      // A verificação definitiva ocorre ao salvar.
    }
  }

  const onSubmit = handleSubmit((values) => save.mutate(values))

  return (
    <Modal
      open
      onClose={onClose}
      dismissible={!save.isPending}
      title={editing ? 'Editar contato' : 'Novo contato'}
      description={editing ? contact?.full_name : 'Cadastre compradores, interessados em locação e proprietários.'}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={save.isPending}>
            Cancelar
          </Button>
          <Button type="submit" form="contact-form" loading={save.isPending} disabled={duplicates.length > 0}>
            {editing ? 'Salvar alterações' : 'Cadastrar contato'}
          </Button>
        </>
      }
    >
      <form
        id="contact-form"
        className="space-y-4"
        onSubmit={(event) => {
          // Evita que o submit alcance um formulário pai (o modal pode abrir sobre outro formulário).
          event.stopPropagation()
          void onSubmit(event)
        }}
        noValidate
      >
        {duplicates.length > 0 && (
          <Alert tone="warning" title="Possível cadastro duplicado">
            <p>Já existe contato com os mesmos dados. Consulte o cadastro existente antes de continuar:</p>
            <ul className="mt-2 space-y-1.5">
              {duplicates.map((match) => (
                <li key={match.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-surface/70 px-2.5 py-1.5">
                  <span>
                    <strong className="font-medium text-ink">{match.full_name}</strong>
                    <span className="text-muted"> · {formatPhone(match.phone)} · mesmo {match.reasons.join(' e ')}</span>
                  </span>
                  <Link
                    to={`/contatos/${match.id}`}
                    onClick={onClose}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-brand-800 hover:underline"
                  >
                    Ver contato <ArrowUpRight className="size-3.5" aria-hidden="true" />
                  </Link>
                </li>
              ))}
            </ul>
            <p className="mt-2 text-xs">Altere o telefone ou e-mail se for outra pessoa.</p>
          </Alert>
        )}

        <TextField label="Nome completo" required autoFocus error={errors.full_name?.message} {...register('full_name')} />

        <div className="grid gap-4 sm:grid-cols-2">
          <Controller
            control={control}
            name="phone"
            render={({ field }) => (
              <PhoneField
                label="Telefone"
                required
                error={errors.phone?.message}
                value={field.value}
                onChange={(value) => {
                  field.onChange(value)
                  if (duplicates.length) setDuplicates([])
                }}
                onBlur={() => {
                  field.onBlur()
                  void checkEarly()
                }}
                name={field.name}
                ref={field.ref}
              />
            )}
          />
          <TextField
            label="E-mail"
            type="email"
            autoComplete="email"
            error={errors.email?.message}
            {...register('email', {
              onChange: () => duplicates.length && setDuplicates([]),
              onBlur: () => void checkEarly(),
            })}
          />
        </div>

        <Checkbox label="O WhatsApp é o mesmo número do telefone" {...register('whatsapp_same')} />
        {!whatsappSame && (
          <Controller
            control={control}
            name="whatsapp"
            render={({ field }) => (
              <PhoneField
                label="WhatsApp"
                required
                error={errors.whatsapp?.message}
                value={field.value}
                onChange={field.onChange}
                onBlur={field.onBlur}
                name={field.name}
                ref={field.ref}
              />
            )}
          />
        )}

        <SelectField
          label="Tipo de contato"
          required
          options={toOptions(contactTypeLabels)}
          error={errors.contact_type?.message}
          {...register('contact_type')}
        />
        <TextareaField label="Observações" rows={3} error={errors.notes?.message} {...register('notes')} />
        <RequiredNote />
      </form>
    </Modal>
  )
}
