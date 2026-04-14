import { clsx } from 'clsx'

type BadgeVariant = 'default' | 'success' | 'danger' | 'warning' | 'info'

export function Badge({ variant = 'default', children, className }: {
  variant?: BadgeVariant
  children: React.ReactNode
  className?: string
}) {
  return (
    <span className={clsx(
      'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium',
      {
        'bg-[var(--bg-elevated)] text-[var(--text-secondary)]': variant === 'default',
        'bg-[var(--success-subtle)] text-[var(--success)]': variant === 'success',
        'bg-[var(--danger-subtle)] text-[var(--danger)]': variant === 'danger',
        'bg-[var(--warning-subtle)] text-[var(--warning)]': variant === 'warning',
        'bg-[var(--accent-subtle)] text-[var(--accent)]': variant === 'info',
      },
      className
    )}>
      {children}
    </span>
  )
}
