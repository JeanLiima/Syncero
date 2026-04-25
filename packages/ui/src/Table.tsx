import { type ReactNode } from 'react'
import { clsx } from 'clsx'
import { Skeleton } from './Skeleton'

interface Column<T> {
  key: string
  header: string
  render?: (row: T) => ReactNode
  align?: 'left' | 'right' | 'center'
  className?: string
}

interface TableProps<T> {
  columns: Column<T>[]
  data: T[]
  rowKey: (row: T) => string
  emptyMessage?: string | ReactNode
  onRowClick?: (row: T) => void
  loading?: boolean
}

export function Table<T>({
  columns,
  data,
  rowKey,
  emptyMessage = 'Nenhum item encontrado',
  onRowClick,
  loading,
}: TableProps<T>) {
  return (
    <div className="w-full overflow-x-auto">
      <table className="w-full text-sm">
        {(loading || data.length > 0) && <thead>
          <tr className="border-b border-[var(--bg-border)]">
            {columns.map((col) => (
              <th
                key={col.key}
                className={clsx(
                  'px-4 py-3 text-xs font-medium text-[var(--text-muted)] capitalize',
                  col.align === 'right'
                    ? 'text-right'
                    : col.align === 'center'
                    ? 'text-center'
                    : 'text-left',
                  col.className
                )}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>}
        <tbody>
          {loading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <tr key={i} className="border-b border-[var(--bg-border)]">
                {columns.map((col, j) => (
                  <td key={col.key} className="px-4 py-3">
                    <Skeleton className={clsx(
                      'h-4',
                      j === 0 ? 'w-24' : j === columns.length - 1 ? 'w-12' : 'w-full'
                    )} />
                  </td>
                ))}
              </tr>
            ))
          ) : data.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="px-4 py-8 text-center text-[var(--text-muted)]">
                {emptyMessage}
              </td>
            </tr>
          ) : (
            data.map((row) => (
              <tr
                key={rowKey(row)}
                onClick={() => onRowClick?.(row)}
                className={clsx(
                  'border-b border-[var(--bg-border)] transition-colors',
                  onRowClick && 'cursor-pointer hover:bg-[var(--bg-elevated)]'
                )}
              >
                {columns.map((col) => (
                  <td
                    key={col.key}
                    className={clsx(
                      'px-4 py-3 text-[var(--text-primary)]',
                      col.align === 'right'
                        ? 'text-right'
                        : col.align === 'center'
                        ? 'text-center'
                        : 'text-left',
                      col.className
                    )}
                  >
                    {col.render ? col.render(row) : String((row as Record<string, unknown>)[col.key] ?? '')}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  )
}
