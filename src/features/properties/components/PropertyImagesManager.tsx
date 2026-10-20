import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ImageOff, ImagePlus, Star, Trash2 } from 'lucide-react'
import { useRef, useState } from 'react'
import { useAuth } from '@/auth/AuthContext'
import { ErrorState } from '@/components/feedback/ErrorState'
import { useToast } from '@/components/feedback/Toast'
import { Button, IconButton } from '@/components/ui/Button'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { Skeleton } from '@/components/ui/Feedback'
import { getErrorMessage } from '@/lib/errors'
import { cn } from '@/lib/utils'
import { deletePropertyImage, listPropertyImages, propertyKeys, setCoverImage, uploadPropertyImages } from '../api'
import { ACCEPTED_IMAGE_TYPES, MAX_IMAGES_PER_PROPERTY } from '../images'
import type { PropertyImage } from '../types'

/** Galeria de fotos de um imóvel já cadastrado (envio, capa e exclusão). */
export function PropertyImagesManager({ propertyId, editable = true }: { propertyId: string; editable?: boolean }) {
  const queryClient = useQueryClient()
  const toast = useToast()
  const { permissions, profile } = useAuth()
  const inputRef = useRef<HTMLInputElement>(null)
  const [toDelete, setToDelete] = useState<PropertyImage | null>(null)
  const [preview, setPreview] = useState<PropertyImage | null>(null)

  const imagesQuery = useQuery({
    queryKey: propertyKeys.images(propertyId),
    queryFn: () => listPropertyImages(propertyId),
    staleTime: 30 * 60_000, // URLs assinadas valem 1 hora
  })
  const images = imagesQuery.data ?? []
  const invalidate = () => queryClient.invalidateQueries({ queryKey: propertyKeys.images(propertyId) })

  const upload = useMutation({
    mutationFn: (files: File[]) => uploadPropertyImages(propertyId, files, images.length),
    onSuccess: async ({ uploaded, errors }) => {
      await invalidate()
      if (uploaded) toast.success(uploaded === 1 ? 'Foto enviada.' : `${uploaded} fotos enviadas.`)
      if (errors.length) toast.error('Algumas fotos não foram enviadas', errors.join(' '))
    },
    onError: (error) => toast.error('Não foi possível enviar as fotos', getErrorMessage(error)),
  })

  const remove = useMutation({
    mutationFn: deletePropertyImage,
    onSuccess: async () => {
      await invalidate()
      setToDelete(null)
      toast.success('Foto excluída.')
    },
    onError: (error) => toast.error('Não foi possível excluir a foto', getErrorMessage(error)),
  })

  const cover = useMutation({
    mutationFn: (imageId: string) => setCoverImage(images, imageId),
    onSuccess: async () => {
      await invalidate()
      toast.success('Foto de capa atualizada.')
    },
    onError: (error) => toast.error('Não foi possível definir a capa', getErrorMessage(error)),
  })

  const onFiles = (list: FileList | null) => {
    if (!list?.length) return
    const files = Array.from(list)
    if (images.length + files.length > MAX_IMAGES_PER_PROPERTY) {
      toast.error(`Limite de ${MAX_IMAGES_PER_PROPERTY} fotos por imóvel.`)
      return
    }
    upload.mutate(files)
    if (inputRef.current) inputRef.current.value = ''
  }

  const canDelete = (image: PropertyImage) => permissions.isManager || image.created_by === profile?.id

  if (imagesQuery.isLoading) {
    return (
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <Skeleton key={index} className="aspect-[4/3]" />
        ))}
      </div>
    )
  }
  if (imagesQuery.isError) return <ErrorState compact error={imagesQuery.error} onRetry={() => void imagesQuery.refetch()} />

  return (
    <div>
      {images.length === 0 ? (
        <div className="flex flex-col items-center rounded-lg border border-dashed border-line-strong bg-canvas/60 px-6 py-10 text-center">
          <ImageOff className="size-6 text-subtle" aria-hidden="true" />
          <p className="mt-2 text-[13px] font-medium text-ink">Nenhuma foto cadastrada</p>
          <p className="mt-1 text-xs text-muted">Formatos JPG, PNG ou WEBP. Imagens grandes são otimizadas automaticamente.</p>
        </div>
      ) : (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {images.map((image, index) => (
            <li key={image.id} className="group relative overflow-hidden rounded-lg border border-line bg-canvas">
              <button
                type="button"
                className="block aspect-[4/3] w-full"
                onClick={() => setPreview(image)}
                aria-label={`Ampliar foto ${index + 1}`}
              >
                {image.url ? (
                  <img src={image.url} alt={`Foto ${index + 1} do imóvel`} loading="lazy" className="size-full object-cover" />
                ) : (
                  <span className="grid size-full place-items-center text-xs text-muted">Indisponível</span>
                )}
              </button>
              {index === 0 && (
                <span className="absolute top-2 left-2 inline-flex items-center gap-1 rounded-sm bg-brand-900/90 px-1.5 py-0.5 text-[10px] font-medium text-white">
                  <Star className="size-3 fill-mint text-mint" aria-hidden="true" /> Capa
                </span>
              )}
              {editable && (
                <div className="absolute top-2 right-2 flex gap-1 opacity-100 transition-opacity sm:opacity-0 sm:group-focus-within:opacity-100 sm:group-hover:opacity-100">
                  {index !== 0 && (
                    <IconButton
                      label="Definir como capa"
                      variant="secondary"
                      onClick={() => cover.mutate(image.id)}
                      disabled={cover.isPending}
                    >
                      <Star />
                    </IconButton>
                  )}
                  {canDelete(image) && (
                    <IconButton label="Excluir foto" variant="secondary" className="text-danger-700" onClick={() => setToDelete(image)}>
                      <Trash2 />
                    </IconButton>
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {editable && (
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <input
            ref={inputRef}
            type="file"
            accept={ACCEPTED_IMAGE_TYPES.join(',')}
            multiple
            className="sr-only"
            id={`upload-${propertyId}`}
            onChange={(event) => onFiles(event.target.files)}
          />
          <Button variant="secondary" icon={<ImagePlus />} loading={upload.isPending} onClick={() => inputRef.current?.click()}>
            {upload.isPending ? 'Enviando fotos…' : 'Adicionar fotos'}
          </Button>
          <span className="text-xs text-muted">
            {images.length} de {MAX_IMAGES_PER_PROPERTY} fotos
          </span>
        </div>
      )}

      <ConfirmDialog
        open={toDelete !== null}
        title="Excluir foto?"
        description="A foto será removida permanentemente do armazenamento. Esta ação não pode ser desfeita."
        confirmLabel="Excluir foto"
        loading={remove.isPending}
        onConfirm={() => toDelete && remove.mutate(toDelete)}
        onCancel={() => setToDelete(null)}
      />

      {preview?.url && (
        <div
          className="fixed inset-0 z-[55] grid animate-fade-in place-items-center bg-brand-950/85 p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Visualização da foto"
          onClick={() => setPreview(null)}
          onKeyDown={(event) => event.key === 'Escape' && setPreview(null)}
          tabIndex={-1}
          ref={(node) => node?.focus()}
        >
          <img src={preview.url} alt="Foto ampliada do imóvel" className={cn('max-h-[90dvh] max-w-full rounded-lg object-contain shadow-overlay')} />
          <span className="sr-only">Pressione Esc ou clique para fechar.</span>
        </div>
      )}
    </div>
  )
}
