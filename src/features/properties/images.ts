/** Regras e preparo das fotos antes do envio ao Supabase Storage. */

export const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024
export const MAX_IMAGES_PER_PROPERTY = 30
const MAX_DIMENSION = 2000

export function validateImageFile(file: File): string | null {
  if (!(ACCEPTED_IMAGE_TYPES as readonly string[]).includes(file.type)) {
    return `"${file.name}" não é uma imagem JPG, PNG ou WEBP.`
  }
  if (file.size > 20 * 1024 * 1024) {
    return `"${file.name}" é muito grande (máximo de 20 MB antes da otimização).`
  }
  return null
}

/**
 * Redimensiona imagens grandes (até 2000 px no maior lado) e converte para JPEG,
 * reduzindo armazenamento e tempo de carregamento. Imagens pequenas seguem intactas.
 */
export async function prepareImage(file: File): Promise<File> {
  if (typeof createImageBitmap !== 'function') return file
  let bitmap: ImageBitmap
  try {
    bitmap = await createImageBitmap(file)
  } catch {
    return file
  }

  const scale = Math.min(1, MAX_DIMENSION / Math.max(bitmap.width, bitmap.height))
  if (scale === 1 && file.size <= 1.5 * 1024 * 1024) {
    bitmap.close()
    return file
  }

  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * scale)
  canvas.height = Math.round(bitmap.height * scale)
  const context = canvas.getContext('2d')
  if (!context) {
    bitmap.close()
    return file
  }
  context.fillStyle = '#ffffff'
  context.fillRect(0, 0, canvas.width, canvas.height)
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close()

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.85))
  if (!blob || blob.size >= file.size) return file
  const name = file.name.replace(/\.[^.]+$/, '') + '.jpg'
  return new File([blob], name, { type: 'image/jpeg' })
}

export function extensionFor(type: string) {
  if (type === 'image/png') return 'png'
  if (type === 'image/webp') return 'webp'
  return 'jpg'
}
