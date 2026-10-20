type ClassValue = string | false | null | undefined | 0

/** Junta classes condicionalmente (substituto leve para clsx). */
export function cn(...classes: ClassValue[]) {
  return classes.filter(Boolean).join(' ')
}

export function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  const first = parts[0]?.[0] ?? ''
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? '') : ''
  return (first + last).toUpperCase()
}

/** Remove caracteres que têm significado especial nos filtros do PostgREST (or/ilike). */
export function sanitizeSearchTerm(value: string) {
  return value
    .replace(/[%_,()*\\:"']/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80)
}

export function range(page: number, pageSize: number): [number, number] {
  const from = (page - 1) * pageSize
  return [from, from + pageSize - 1]
}

export function nullIfBlank(value: string | null | undefined) {
  const trimmed = value?.trim() ?? ''
  return trimmed === '' ? null : trimmed
}
