import { ImagePlus, X } from 'lucide-react'
import { useEffect, useMemo, useRef } from 'react'
import { Button } from '@/components/ui/Button'
import { ACCEPTED_IMAGE_TYPES, MAX_IMAGES_PER_PROPERTY, validateImageFile } from '../images'

/** Seleção de fotos antes de o imóvel existir: o envio ocorre logo após salvar. */
export function PendingImagesPicker({
  files,
  onChange,
  onError,
}: {
  files: File[]
  onChange: (files: File[]) => void
  onError: (message: string) => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const previews = useMemo(() => files.map((file) => ({ file, url: URL.createObjectURL(file) })), [files])

  useEffect(() => () => previews.forEach((preview) => URL.revokeObjectURL(preview.url)), [previews])

  const add = (list: FileList | null) => {
    if (!list?.length) return
    const incoming = Array.from(list)
    const invalid = incoming.map(validateImageFile).filter((message): message is string => Boolean(message))
    if (invalid.length) onError(invalid.join(' '))
    const valid = incoming.filter((file) => !validateImageFile(file))
    const next = [...files, ...valid].slice(0, MAX_IMAGES_PER_PROPERTY)
    onChange(next)
    if (inputRef.current) inputRef.current.value = ''
  }

  return (
    <div className="sm:col-span-2 xl:col-span-3">
      {previews.length > 0 && (
        <ul className="mb-3 grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-6">
          {previews.map(({ file, url }, index) => (
            <li key={url} className="relative overflow-hidden rounded-md border border-line">
              <img src={url} alt={`Prévia ${index + 1}`} className="aspect-[4/3] w-full object-cover" />
              {index === 0 && (
                <span className="absolute bottom-1 left-1 rounded-sm bg-brand-900/90 px-1 text-[10px] font-medium text-white">Capa</span>
              )}
              <button
                type="button"
                onClick={() => onChange(files.filter((item) => item !== file))}
                className="absolute top-1 right-1 rounded bg-surface/90 p-0.5 text-ink shadow-sm hover:text-danger-700"
                aria-label={`Remover ${file.name}`}
              >
                <X className="size-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED_IMAGE_TYPES.join(',')}
        multiple
        className="sr-only"
        tabIndex={-1}
        onChange={(event) => add(event.target.files)}
      />
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="secondary" icon={<ImagePlus />} onClick={() => inputRef.current?.click()}>
          Selecionar fotos
        </Button>
        <span className="text-xs text-muted">
          {files.length ? `${files.length} foto(s) serão enviadas ao salvar.` : 'JPG, PNG ou WEBP. A primeira foto será a capa.'}
        </span>
      </div>
    </div>
  )
}
