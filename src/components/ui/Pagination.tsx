import { ChevronLeft, ChevronRight } from 'lucide-react'
import { formatNumber } from '@/lib/format'
import { Button } from './Button'

type PaginationProps = {
  page: number
  pageSize: number
  total: number
  onPageChange: (page: number) => void
}

export function Pagination({ page, pageSize, total, onPageChange }: PaginationProps) {
  const pageCount = Math.max(1, Math.ceil(total / pageSize))
  if (total === 0) return null
  const from = (page - 1) * pageSize + 1
  const to = Math.min(page * pageSize, total)

  return (
    <nav
      className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-5 py-3 text-[13px] text-muted"
      aria-label="Paginação"
    >
      <span className="tabular">
        Exibindo <strong className="font-medium text-ink">{formatNumber(from)}–{formatNumber(to)}</strong> de{' '}
        <strong className="font-medium text-ink">{formatNumber(total)}</strong>
      </span>
      {pageCount > 1 && (
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => onPageChange(page - 1)}
            disabled={page <= 1}
            icon={<ChevronLeft />}
          >
            Anterior
          </Button>
          <span className="tabular px-1" aria-current="page">
            {page} / {pageCount}
          </span>
          <Button variant="secondary" size="sm" onClick={() => onPageChange(page + 1)} disabled={page >= pageCount}>
            Próxima
            <ChevronRight />
          </Button>
        </div>
      )}
    </nav>
  )
}
