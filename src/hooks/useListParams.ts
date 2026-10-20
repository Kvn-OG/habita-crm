import { useCallback, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'

/**
 * Filtros e paginação de listagens persistidos na URL
 * (mantém o estado ao voltar do detalhe e permite compartilhar o link).
 */
export function useListParams<K extends string>(keys: readonly K[]) {
  const [params, setParams] = useSearchParams()

  const keysSignature = keys.join('|')
  const values = useMemo(
    () => Object.fromEntries(keysSignature.split('|').map((key) => [key, params.get(key) ?? ''])) as Record<K, string>,
    [params, keysSignature],
  )
  const page = Math.max(1, Number(params.get('pagina')) || 1)

  const set = useCallback(
    (patch: Partial<Record<K | 'pagina', string | number | null>>) => {
      setParams(
        (previous) => {
          const next = new URLSearchParams(previous)
          for (const [key, value] of Object.entries(patch)) {
            if (value === null || value === undefined || value === '' || (key === 'pagina' && value === 1)) next.delete(key)
            else next.set(key, String(value))
          }
          // Qualquer mudança de filtro volta para a primeira página.
          if (!('pagina' in patch)) next.delete('pagina')
          return next
        },
        { replace: true },
      )
    },
    [setParams],
  )

  const hasFilters = keys.some((key) => values[key] !== '')

  return { values, page, set, hasFilters }
}
