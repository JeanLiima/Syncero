import { clsx } from 'clsx'

interface SkeletonProps {
  className?: string
}

export function Skeleton({ className }: SkeletonProps) {
  return (
    <div
      className={clsx(
        'animate-pulse rounded-[var(--radius-sm)] bg-[var(--bg-elevated)]',
        className
      )}
    />
  )
}

// Convenience: a row of skeletons for table bodies
export function SkeletonRows({ rows = 5, cols }: { rows?: number; cols: number }) {
  return (
    <>
      {Array.from({ length: rows }).map((_, i) => (
        <tr key={i} className="border-b border-[var(--bg-border)]">
          {Array.from({ length: cols }).map((_, j) => (
            <td key={j} className="px-4 py-3">
              <Skeleton className={clsx('h-4', j === 0 ? 'w-24' : j === cols - 1 ? 'w-12' : 'w-full')} />
            </td>
          ))}
        </tr>
      ))}
    </>
  )
}
