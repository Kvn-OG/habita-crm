/** Preparo da foto de perfil antes do envio: recorte quadrado central, 320 px, JPEG. */

import { ACCEPTED_IMAGE_TYPES } from '@/features/properties/images'

const AVATAR_SIZE = 320

export function validateAvatarFile(file: File): string | null {
  if (!(ACCEPTED_IMAGE_TYPES as readonly string[]).includes(file.type)) return 'Escolha uma imagem JPG, PNG ou WEBP.'
  if (file.size > 20 * 1024 * 1024) return 'A imagem é muito grande (máximo de 20 MB).'
  return null
}

export async function prepareAvatar(file: File): Promise<File> {
  const bitmap = await createImageBitmap(file)
  const side = Math.min(bitmap.width, bitmap.height)
  const size = Math.min(AVATAR_SIZE, side)
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const context = canvas.getContext('2d')
  if (!context) {
    bitmap.close()
    throw new Error('Não foi possível processar a imagem neste navegador.')
  }
  context.fillStyle = '#ffffff'
  context.fillRect(0, 0, size, size)
  context.drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, size, size)
  bitmap.close()
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.85))
  if (!blob) throw new Error('Não foi possível processar a imagem neste navegador.')
  return new File([blob], 'avatar.jpg', { type: 'image/jpeg' })
}
