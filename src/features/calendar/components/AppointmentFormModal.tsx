import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { useAuth } from '@/auth/AuthContext'
import { useToast } from '@/components/feedback/Toast'
import { AsyncPicker, type PickerOption } from '@/components/forms/AsyncPicker'
import { Field, RequiredNote } from '@/components/forms/Field'
import { Select, SelectField, TextareaField, TextField } from '@/components/forms/inputs'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { searchLeadOptions } from '@/features/leads/api'
import { searchPropertyOptions } from '@/features/properties/api'
import { memberName, useTeamMembers } from '@/hooks/useTeamMembers'
import { getErrorMessage } from '@/lib/errors'
import { appointmentTypeLabels, toOptions } from '@/lib/labels'
import { appointmentKeys, createAppointment, updateAppointment } from '../api'
import {
  appointmentSchema, appointmentToFormValues, DURATION_OPTIONS, suggestedStart, type AppointmentFormValues,
} from '../schema'
import type { Appointment } from '../types'

export type AppointmentDefaults = {
  lead?: PickerOption
  contactId?: string
  property?: PickerOption
  title?: string
}

type AppointmentFormModalProps = {
  open: boolean
  onClose: () => void
  appointment?: Appointment | null
  defaults?: AppointmentDefaults
}

export function AppointmentFormModal(props: AppointmentFormModalProps) {
  if (!props.open) return null
  return <AppointmentFormContent {...props} />
}

function AppointmentFormContent({ onClose, appointment, defaults }: AppointmentFormModalProps) {
  const queryClient = useQueryClient()
  const toast = useToast()
  const { profile } = useAuth()
  const teamQuery = useTeamMembers()
  const isNew = !appointment

  const [lead, setLead] = useState<PickerOption[]>(() => {
    if (appointment?.lead) return [{ id: appointment.lead.id, label: appointment.lead.contacts?.full_name ?? 'Lead' }]
    return defaults?.lead ? [defaults.lead] : []
  })
  const [property, setProperty] = useState<PickerOption[]>(() => {
    if (appointment?.property) return [{ id: appointment.property.id, label: `${appointment.property.code} · ${appointment.property.title}` }]
    return defaults?.property ? [defaults.property] : []
  })

  const start = suggestedStart()
  const { register, handleSubmit, setValue, formState: { errors } } = useForm<AppointmentFormValues>({
    resolver: zodResolver(appointmentSchema(isNew)),
    defaultValues: appointment
      ? appointmentToFormValues(appointment)
      : {
          appointment_type: 'visita',
          title: defaults?.title ?? '',
          date: start.date,
          time: start.time,
          duration: '60',
          location: '',
          notes: '',
          assigned_to: profile?.id ?? '',
          lead_id: defaults?.lead?.id ?? '',
          property_id: defaults?.property?.id ?? '',
        },
  })

  const save = useMutation({
    mutationFn: (values: AppointmentFormValues) => {
      const contactId = appointment?.contact_id ?? defaults?.contactId ?? null
      return appointment ? updateAppointment(appointment.id, values, contactId) : createAppointment(values, contactId)
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: appointmentKeys.all }),
        queryClient.invalidateQueries({ queryKey: ['activities'] }),
        queryClient.invalidateQueries({ queryKey: ['dashboard'] }),
        queryClient.invalidateQueries({ queryKey: ['agenda-today'] }),
      ])
      toast.success(isNew ? 'Compromisso agendado.' : 'Compromisso atualizado.')
      onClose()
    },
    onError: (error) => toast.error('Não foi possível salvar o compromisso', getErrorMessage(error)),
  })

  return (
    <Modal
      open
      size="lg"
      onClose={onClose}
      dismissible={!save.isPending}
      title={isNew ? 'Agendar compromisso' : 'Editar compromisso'}
      description="Visitas e reuniões ficam registradas na agenda e no histórico do lead."
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={save.isPending}>
            Cancelar
          </Button>
          <Button type="submit" form="appointment-form" loading={save.isPending}>
            {isNew ? 'Agendar' : 'Salvar alterações'}
          </Button>
        </>
      }
    >
      <form
        id="appointment-form"
        className="space-y-4"
        noValidate
        onSubmit={(event) => {
          event.stopPropagation()
          void handleSubmit((values) => save.mutate(values))(event)
        }}
      >
        <div className="grid gap-4 sm:grid-cols-[180px_1fr]">
          <SelectField label="Tipo" required options={toOptions(appointmentTypeLabels)} {...register('appointment_type')} />
          <TextField label="Título" required placeholder="Visita ao apartamento IM-0001" error={errors.title?.message} {...register('title')} />
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <TextField label="Data" type="date" required error={errors.date?.message} {...register('date')} />
          <TextField label="Horário" type="time" step={300} required hint="Formato 24 horas" error={errors.time?.message} {...register('time')} />
          <SelectField label="Duração" options={DURATION_OPTIONS} {...register('duration')} />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Lead">
            {(fieldProps) => (
              <AsyncPicker
                {...fieldProps}
                queryKey="appointment-lead"
                search={searchLeadOptions}
                selected={lead}
                onChange={(selected) => {
                  setLead(selected)
                  setValue('lead_id', selected[0]?.id ?? '')
                }}
                placeholder="Buscar lead em andamento"
                emptyText="Nenhum lead em andamento encontrado."
              />
            )}
          </Field>
          <Field label="Imóvel">
            {(fieldProps) => (
              <AsyncPicker
                {...fieldProps}
                queryKey="appointment-property"
                search={searchPropertyOptions}
                selected={property}
                onChange={(selected) => {
                  setProperty(selected)
                  setValue('property_id', selected[0]?.id ?? '')
                }}
                placeholder="Buscar imóvel"
              />
            )}
          </Field>
          <TextField label="Local" placeholder="Endereço do encontro" error={errors.location?.message} {...register('location')} />
          <Field label="Responsável">
            {(fieldProps) => (
              <Select {...fieldProps} {...register('assigned_to')}>
                <option value="">Sem responsável</option>
                {(teamQuery.data ?? []).map((member) => (
                  <option key={member.id} value={member.id}>
                    {memberName(member)}
                    {member.id === profile?.id ? ' (você)' : ''}
                  </option>
                ))}
              </Select>
            )}
          </Field>
        </div>
        <TextareaField label="Observações" rows={2} error={errors.notes?.message} {...register('notes')} />
        <RequiredNote />
      </form>
    </Modal>
  )
}
