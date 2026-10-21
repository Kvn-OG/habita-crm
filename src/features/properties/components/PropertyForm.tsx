import { zodResolver } from '@hookform/resolvers/zod'
import { UserPlus } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { useState, type ReactNode } from 'react'
import { Controller, useForm, useWatch } from 'react-hook-form'
import { useToast } from '@/components/feedback/Toast'
import { AsyncPicker, type PickerOption } from '@/components/forms/AsyncPicker'
import { Field, FormSection, RequiredNote } from '@/components/forms/Field'
import {
  CurrencyField, DecimalField, integerRegisterOptions, Select, SelectField, TextareaField, TextField,
} from '@/components/forms/inputs'
import { Button } from '@/components/ui/Button'
import { getErrorMessage } from '@/lib/errors'
import { BRAZILIAN_STATES, propertyPurposeLabels, propertyStatusLabels, propertyTypeLabels, toOptions } from '@/lib/labels'
import { ContactFormModal } from '@/features/contacts/components/ContactFormModal'
import { contactToOption, searchContactOptions } from '@/features/contacts/api'
import { suggestPropertyCode } from '../api'
import { propertySchema, type PropertyFormValues } from '../schema'

type PropertyFormProps = {
  defaultValues: PropertyFormValues
  defaultOwners: PickerOption[]
  propertyId?: string
  /** Código do imóvel já cadastrado; no cadastro novo o banco gera ao salvar. */
  code: string | null
  submitLabel: string
  onSubmit: (values: PropertyFormValues, ownerIds: string[]) => Promise<void>
  onCancel: () => void
  /** Seção de fotos (seleção prévia na criação ou galeria na edição). */
  photos: ReactNode
}

export function PropertyForm({ defaultValues, defaultOwners, propertyId, code, submitLabel, onSubmit, onCancel, photos }: PropertyFormProps) {
  const toast = useToast()
  const [owners, setOwners] = useState<PickerOption[]>(defaultOwners)
  const [newOwnerOpen, setNewOwnerOpen] = useState(false)

  const {
    register, control, handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<PropertyFormValues>({ resolver: zodResolver(propertySchema), defaultValues })

  const purpose = useWatch({ control, name: 'purpose' })
  const creating = !propertyId

  // Cadastro novo: mostra o próximo código como prévia (o banco define o valor final ao salvar).
  const codePreview = useQuery({ queryKey: ['property-code-suggestion'], queryFn: suggestPropertyCode, enabled: creating, staleTime: 0 })
  const codeValue = code ?? (codePreview.isLoading ? 'Gerando código…' : codePreview.data ?? 'Gerado ao salvar')

  const submit = handleSubmit(async (values) => {
    try {
      await onSubmit(values, owners.map((owner) => owner.id))
    } catch (error) {
      toast.error('Não foi possível salvar o imóvel', getErrorMessage(error))
    }
  })

  return (
    <>
      <form onSubmit={(event) => void submit(event)} noValidate className="rounded-lg border border-line bg-surface shadow-card">
        <div className="px-5 py-6 sm:px-7">
          <FormSection title="Identificação" description="Dados principais exibidos na listagem.">
            <TextField
              label="Código do imóvel"
              value={codeValue}
              readOnly
              className="[&_input]:cursor-default [&_input]:bg-canvas [&_input]:font-medium [&_input]:text-muted"
              hint={creating ? 'Gerado automaticamente ao salvar. Não pode ser alterado.' : 'Gerado automaticamente. Não pode ser alterado.'}
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

          <FormSection title="Localização" description="Região do imóvel.">
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
