import { type ButtonHTMLAttributes, type ReactNode } from 'react'
import { clsx } from 'clsx'

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  icon: ReactNode
  tooltip: string
  variant?: 'default' | 'danger' | 'warning' | 'success'
  wrapperClassName?: string
}

export function IconButton({ icon, tooltip, variant = 'default', wrapperClassName, className, ...props }: IconButtonProps) {
  return (
    <div className={clsx('relative group/iconbtn', wrapperClassName)}>
      <button
        type="button"
        className={clsx(
          'cursor-pointer p-1.5 rounded hover:bg-[var(--bg-border)] text-[var(--text-muted)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed',
          {
            'hover:text-[var(--accent)]': variant === 'default',
            'hover:text-[var(--danger)]': variant === 'danger',
            'hover:text-[var(--warning)]': variant === 'warning',
            'hover:text-[var(--success)]': variant === 'success',
          },
          className
        )}
        {...props}
      >
        {icon}
      </button>
      <span className="pointer-events-none absolute -top-8 right-0 whitespace-nowrap rounded px-2 py-1 text-xs bg-[var(--bg-elevated)] border border-[var(--bg-border)] text-[var(--text-secondary)] opacity-0 group-hover/iconbtn:opacity-100 transition-opacity z-10">
        {tooltip}
      </span>
    </div>
  )
}
