import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

export type Column<T> = {
  key: string
  header: ReactNode
  cell: (row: T) => ReactNode
  className?: string
  headerClassName?: string
  /** Oculta a coluna abaixo de lg (tablets). */
  hideOnTablet?: boolean
}

type DataTableProps<T> = {
  rows: T[]
  columns: Column<T>[]
  rowKey: (row: T) => string
  /** Representação em cartão para telas pequenas (< md). */
  mobileItem: (row: T) => ReactNode
  onRowClick?: (row: T) => void
  caption: string
}

/**
 * Tabela densa no desktop e lista de cartões no celular.
 * A navegação por teclado é feita pelos links/botões dentro das células.
 */
export function DataTable<T>({ rows, columns, rowKey, mobileItem, onRowClick, caption }: DataTableProps<T>) {
  return (
    <>
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full border-collapse text-left text-[13px]">
          <caption className="sr-only">{caption}</caption>
          <thead>
            <tr className="border-b border-line bg-canvas/70">
              {columns.map((column) => (
                <th
                  key={column.key}
                  scope="col"
                  className={cn(
                    'h-10 px-4 text-xs font-medium whitespace-nowrap text-muted first:pl-5 last:pr-5',
                    column.hideOnTablet && 'hidden lg:table-cell',
                    column.headerClassName,
                  )}
                >
                  {column.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.map((row) => (
              <tr
                key={rowKey(row)}
                onClick={onRowClick ? (event) => {
                  // Não intercepta cliques em elementos interativos.
                  if ((event.target as HTMLElement).closest('a,button,input,select,label')) return
                  onRowClick(row)
                } : undefined}
                className={cn('transition-colors hover:bg-hover/70', onRowClick && 'cursor-pointer')}
              >
                {columns.map((column) => (
                  <td
                    key={column.key}
                    className={cn(
                      'h-14 px-4 align-middle first:pl-5 last:pr-5',
                      column.hideOnTablet && 'hidden lg:table-cell',
                      column.className,
                    )}
                  >
                    {column.cell(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ul className="divide-y divide-line md:hidden" aria-label={caption}>
        {rows.map((row) => (
          <li key={rowKey(row)}>{mobileItem(row)}</li>
        ))}
      </ul>
    </>
  )
}
