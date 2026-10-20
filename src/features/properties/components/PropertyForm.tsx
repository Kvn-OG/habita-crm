import { zodResolver } from '@hookform/resolvers/zod'
import { MapPinned, UserPlus } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { useEffect, useState, type ReactNode } from 'react'
import { Controller, useForm, useWatch } from 'react-hook-form'
import { useToast } from '@/components/feedback/Toast'
import { AsyncPicker, type PickerOption } from '@/components/forms/AsyncPicker'
import { Field, FormSection, RequiredNote } from '@/components/forms/Field'
import {
  CepInput, CurrencyField, DecimalField, integerRegisterOptions, Select, SelectField, TextareaField, TextField,
} from '@/components/forms/inputs'
import { Button } from '@/components/ui/Button'
import { getErrorMessage } from '@/lib/errors'
import { BRAZILIAN_STATES, propertyPurposeLabels, propertyStatusLabels, propertyTypeLabels, toOptions } from '@/lib/labels'
import { ContactFormModal } from '@/features/contacts/components/ContactFormModal'
import { contactToOption, searchContactOptions } from '@/features/contacts/api'
import { isPropertyCodeTaken, lookupCep, suggestPropertyCode } from '../api'
import { propertySchema, type PropertyFormValues } from '../schema'

type PropertyFormProps = {
  defaultValues: PropertyFormValues
  defaultOwners: PickerOption[]
  propertyId?: string
  submitLabel: string
  onSubmit: (values: PropertyFormValues, ownerIds: string[]) => Promise<void>
  onCancel: () => void
  /** Seção de fotos (seleção prévia na criação ou galeria na edição). */
  photos: ReactNode
}

export function PropertyForm({ defaultValues, defaultOwners, propertyId, submitLabel, onSubmit, onCancel, photos }: PropertyFormProps) {
  const toast = useToast()
  const [owners, setOwners] = useState<PickerOption[]>(defaultOwners)
  const [newOwnerOpen, setNewOwnerOpen] = useState(false)
  const [cepLoading, setCepLoading] = useState(false)

  const {
    register, control, handleSubmit, setValue, setError, getValues, getFieldState,
    formState: { errors, isSubmitting },
  } = useForm<PropertyFormValues>({ resolver: zodResolver(propertySchema), defaultValues })

  const purpose = useWatch({ control, name: 'purpose' })
  const creating = !propertyId

  // Cadastro novo: sugere o próximo código sequencial (o usuário pode alterar).
  const codeSuggestion = useQuery({ queryKey: ['property-code-suggestion'], queryFn: suggestPropertyCode, enabled: creating, staleTime: 0 })
  useEffect(() => {
    if (codeSuggestion.data && !getFieldState('code').isDirty && !getValues('code')) {
      setValue('code', codeSuggestion.data, { shouldValidate: false })
    }
  }, [codeSuggestion.data, getFieldState, getValues, setValue])

  const searchCep = async () => {
    const cep = getValues('postal_code')
    if (cep.replace(/\D/g, '').length !== 8) {
      setError('postal_code', { message: 'Informe os 8 dígitos do CEP para buscar o endereço.' })
      return
    }
    setCepLoading(true)
    try {
      const result = await lookupCep(cep)
      if (!result) {
        setError('postal_code', { message: 'CEP não encontrado. Preencha o endereço manualmente.' })
        return
      }
      setValue('street', result.street, { shouldDirty: true })
      setValue('neighborhood', result.neighborhood, { shouldDirty: true })
      setValue('city', result.city, { shouldDirty: true })
      setValue('state', result.state, { shouldDirty: true })
      toast.info('Endereço preenchido pelo CEP.', 'Confira os dados e informe o número.')
    } catch (error) {
      toast.error('Não foi possível consultar o CEP', getErrorMessage(error))
    } finally {
      setCepLoading(false)
    }
  }

  const submit = handleSubmit(async (values) => {
    try {
      if (await isPropertyCodeTaken(values.code, propertyId)) {
        if (creating) {
          // Outro usuário pode ter usado o código sugerido nesse meio-tempo.
          const next = await suggestPropertyCode()
          setValue('code', next)
          setError('code', { message: `O código ${values.code.toUpperCase()} já está em uso. Sugerimos ${next}; clique em salvar novamente.` }, { shouldFocus: true })
        } else {
          setError('code', { message: 'Este código já está em uso por outro imóvel.' }, { shouldFocus: true })
        }
        return
      }
      await onSubmit(values, owners.map((owner) => owner.id))
    } catch (error) {
      const message = getErrorMessage(error)
      if (/código/i.test(message)) setError('code', { message }, { shouldFocus: true })
      toast.error('Não foi possível salvar o imóvel', message)
    }
  })

  return (
    <>
      <form onSubmit={(event) => void submit(event)} noValidate className="rounded-lg border border-line bg-surface shadow-card">
        <div className="px-5 py-6 sm:px-7">
          <FormSection title="Identificação" description="Dados principais exibidos na listagem.">
            <TextField
              label="Código do imóvel"
              required
              placeholder={creating && codeSuggestion.isLoading ? 'Gerando código…' : 'IM-0001'}
              hint={creating ? 'Gerado automaticamente. Você pode alterar se preferir.' : 'Único na carteira. Letras, números e hífen.'}
              style={{ textTransform: 'uppercase' }}
              error={errors.code?.message}
              {...register('code')}
            />
            <TextField
              label="Título"
              required
              autoFocus={creating}
              placeholder="Apartamento 2 quartos com varanda"
              className="sm:col-span-1 xl:col-span-2"
              error={errors.title?.message}
              {...register('title')}
            />
            <SelectField
              label="Tipo do imóvel"
              required
              placeholder="Selecione"
              options={toOptions(propertyTypeLabels)}
              error={errors.property_type?.message}
              {...register('property_type')}
            />
            <SelectField
              label="Finalidade"
              required
              options={toOptions(propertyPurposeLabels)}
              error={errors.purpose?.message}
              {...register('purpose')}
            />
            <SelectField
              label="Situação comercial"
              required
              options={toOptions(propertyStatusLabels)}
              error={errors.status?.message}
              {...register('status')}
            />
            <TextareaField
              label="Descrição"
              rows={4}
              className="sm:col-span-2 xl:col-span-3"
              placeholder="Diferenciais, estado de conservação, proximidades…"
              error={errors.description?.message}
              {...register('description')}
            />
          </FormSection>

          <FormSection title="Valores" description="Em reais. Digite apenas números.">
            {purpose !== 'locacao' && (
              <Controller
                control={control}
                name="sale_price"
                render={({ field }) => (
                  <CurrencyField label="Valor de venda" required error={errors.sale_price?.message} value={field.value} onChange={field.onChange} onBlur={field.onBlur} name={field.name} ref={field.ref} />
                )}
              />
            )}
            {purpose !== 'venda' && (
              <Controller
                control={control}
                name="rent_price"
                render={({ field }) => (
                  <CurrencyField label="Valor do aluguel (mensal)" required error={errors.rent_price?.message} value={field.value} onChange={field.onChange} onBlur={field.onBlur} name={field.name} ref={field.ref} />
                )}
              />
            )}
            <Controller
              control={control}
              name="condo_fee"
              render={({ field }) => (
                <CurrencyField label="Condomínio (mensal)" error={errors.condo_fee?.message} value={field.value} onChange={field.onChange} onBlur={field.onBlur} name={field.name} ref={field.ref} />
              )}
            />
            <Controller
              control={control}
              name="iptu"
              render={({ field }) => (
                <CurrencyField label="IPTU (anual)" error={errors.iptu?.message} value={field.value} onChange={field.onChange} onBlur={field.onBlur} name={field.name} ref={field.ref} />
              )}
            />
          </FormSection>

          <FormSection title="Localização" description="Use a busca por CEP para agilizar o preenchimento.">
            <Field label="CEP" error={errors.postal_code?.message}>
              {(fieldProps) => (
                <div className="flex gap-2">
                  <Controller
                    control={control}
                    name="postal_code"
                    render={({ field }) => (
                      <CepInput {...fieldProps} value={field.value} onChange={field.onChange} onBlur={field.onBlur} name={field.name} ref={field.ref} />
                    )}
                  />
                  <Button variant="secondary" onClick={() => void searchCep()} loading={cepLoading} icon={<MapPinned />} aria-label="Buscar endereço pelo CEP">
                    <span className="hidden sm:inline">Buscar</span>
                  </Button>
                </div>
              )}
            </Field>
            <Field label="Estado" error={errors.state?.message}>
              {(fieldProps) => (
                <Select {...fieldProps} {...register('state')}>
                  <option value="">Selecione</option>
                  {BRAZILIAN_STATES.map((state) => (
                    <option key={state} value={state}>
                      {state}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
            <TextField label="Cidade" error={errors.city?.message} {...register('city')} />
            <TextField label="Bairro" error={errors.neighborhood?.message} {...register('neighborhood')} />
            <TextField label="Endereço" placeholder="Rua, avenida…" className="xl:col-span-2" error={errors.street?.message} {...register('street')} />
            <TextField label="Número" error={errors.street_number?.message} {...register('street_number')} />
            <TextField label="Complemento" placeholder="Apto, bloco, lote…" error={errors.complement?.message} {...register('complement')} />
          </FormSection>

          <FormSection title="Características" description="Áreas em metros quadrados. Use vírgula para decimais.">
            <Controller
              control={control}
              name="land_area"
              render={({ field }) => (
                <DecimalField label="Área do terreno" suffix="m²" error={errors.land_area?.message} value={field.value} onChange={field.onChange} onBlur={field.onBlur} name={field.name} ref={field.ref} />
              )}
            />
            <Controller
              control={control}
              name="built_area"
              render={({ field }) => (
                <DecimalField label="Área construída / privativa" suffix="m²" error={errors.built_area?.message} value={field.value} onChange={field.onChange} onBlur={field.onBlur} name={field.name} ref={field.ref} />
              )}
            />
            <TextField label="Quartos" type="number" min={0} max={99} step={1} inputMode="numeric" error={errors.bedrooms?.message} {...register('bedrooms', integerRegisterOptions)} />
            <TextField label="Suítes" type="number" min={0} max={99} step={1} inputMode="numeric" error={errors.suites?.message} {...register('suites', integerRegisterOptions)} />
            <TextField label="Banheiros" type="number" min={0} max={99} step={1} inputMode="numeric" error={errors.bathrooms?.message} {...register('bathrooms', integerRegisterOptions)} />
            <TextField label="Vagas de garagem" type="number" min={0} max={99} step={1} inputMode="numeric" error={errors.parking_spaces?.message} {...register('parking_spaces', integerRegisterOptions)} />
          </FormSection>

          <FormSection title="Proprietários" description="Um imóvel pode ter um ou mais proprietários, vinculados ao cadastro de contatos.">
            <Field label="Proprietário(s)" className="sm:col-span-2 xl:col-span-3" hint="Busque pelo nome ou telefone do contato.">
              {(fieldProps) => (
                <AsyncPicker
                  {...fieldProps}
                  multiple
                  queryKey="property-owner"
                  search={searchContactOptions}
                  selected={owners}
                  onChange={setOwners}
                  placeholder="Buscar contato"
                  emptyText="Nenhum contato encontrado."
                  footer={
                    <button
                      type="button"
                      className="inline-flex items-center gap-1.5 font-medium text-brand-800 hover:underline"
                      onClick={() => setNewOwnerOpen(true)}
                    >
                      <UserPlus className="size-3.5" aria-hidden="true" /> Cadastrar novo proprietário
                    </button>
                  }
                />
              )}
            </Field>
          </FormSection>

          <FormSection title="Fotos" description="Armazenadas com acesso restrito à equipe.">
            {photos}
          </FormSection>
        </div>

        <div className="sticky bottom-0 flex flex-col-reverse gap-3 rounded-b-lg border-t border-line bg-surface/95 px-5 py-4 backdrop-blur sm:flex-row sm:items-center sm:justify-between sm:px-7">
          <RequiredNote />
          <div className="flex flex-col-reverse gap-2 sm:flex-row">
            <Button variant="secondary" onClick={onCancel} disabled={isSubmitting}>
              Cancelar
            </Button>
            <Button type="submit" loading={isSubmitting}>
              {submitLabel}
            </Button>
          </div>
        </div>
      </form>

      <ContactFormModal
        open={newOwnerOpen}
        onClose={() => setNewOwnerOpen(false)}
        defaultType="proprietario"
        onSaved={(contact) => setOwners((current) => [...current, contactToOption(contact)])}
      />
    </>
  )
}
