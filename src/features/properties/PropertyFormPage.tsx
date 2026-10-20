import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ErrorState } from '@/components/feedback/ErrorState'
import { useToast } from '@/components/feedback/Toast'
import { Card } from '@/components/ui/Card'
import { LoadingScreen } from '@/components/ui/Feedback'
import { formatPhone } from '@/lib/format'
import { createProperty, getProperty, propertyKeys, updateProperty, uploadPropertyImages } from './api'
import { PendingImagesPicker } from './components/PendingImagesPicker'
import { PropertyForm } from './components/PropertyForm'
import { PropertyImagesManager } from './components/PropertyImagesManager'
import { emptyPropertyValues, propertyToFormValues } from './schema'

export function NewPropertyPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const toast = useToast()
  const [files, setFiles] = useState<File[]>([])

  return (
    <div className="mx-auto max-w-6xl">
      <PropertyForm
        defaultValues={emptyPropertyValues}
        defaultOwners={[]}
        submitLabel="Cadastrar imóvel"
        onCancel={() => navigate('/imoveis')}
        photos={<PendingImagesPicker files={files} onChange={setFiles} onError={(message) => toast.error('Arquivo inválido', message)} />}
        onSubmit={async (values, ownerIds) => {
          const id = await createProperty(values, ownerIds)
          await queryClient.invalidateQueries({ queryKey: propertyKeys.all })
          toast.success('Imóvel cadastrado.', `${values.code.toUpperCase()} · ${values.title}`)
          if (files.length) {
            const { uploaded, errors } = await uploadPropertyImages(id, files, 0)
            if (uploaded) toast.success(`${uploaded} foto(s) enviada(s).`)
            if (errors.length) toast.error('Algumas fotos não foram enviadas', errors.join(' '))
          }
          navigate(`/imoveis/${id}`, { replace: true })
        }}
      />
    </div>
  )
}

export function EditPropertyPage() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const toast = useToast()
  const query = useQuery({ queryKey: propertyKeys.detail(id), queryFn: () => getProperty(id) })

  if (query.isLoading) return <LoadingScreen label="Carregando imóvel" />
  if (query.isError || !query.data) {
    return (
      <Card>
        <ErrorState error={query.error} title="Imóvel não encontrado" onRetry={() => void query.refetch()} />
      </Card>
    )
  }

  const property = query.data
  return (
    <div className="mx-auto max-w-6xl">
      <PropertyForm
        propertyId={property.id}
        defaultValues={propertyToFormValues(property)}
        defaultOwners={property.owners.map((owner) => ({ id: owner.id, label: owner.full_name, description: formatPhone(owner.phone) }))}
        submitLabel="Salvar alterações"
        onCancel={() => navigate(`/imoveis/${property.id}`)}
        photos={
          <div className="sm:col-span-2 xl:col-span-3">
            <PropertyImagesManager propertyId={property.id} />
          </div>
        }
        onSubmit={async (values, ownerIds) => {
          await updateProperty(property.id, values, ownerIds)
          await queryClient.invalidateQueries({ queryKey: propertyKeys.all })
          toast.success('Imóvel atualizado.', `${values.code.toUpperCase()} · ${values.title}`)
          navigate(`/imoveis/${property.id}`)
        }}
      />
    </div>
  )
}
