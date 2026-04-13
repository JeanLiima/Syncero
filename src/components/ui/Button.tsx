import { type ButtonHTMLAttributes, forwardRef } from 'react'
import { clsx } from 'clsx'
import { Spinner } from './Spinner'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'ghost' | 'danger'
  size?: 'sm' | 'md' | 'lg'
  loading?: boolean
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'primary', size = 'md', loading, disabled, children, className, ...props }, ref) => {
    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={clsx(
          'cursor-pointer inline-flex items-center justify-center gap-2 font-medium rounded-[var(--radius-md)] transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98]',
          {
            'bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white': variant === 'primary',
            'bg-transparent hover:bg-[var(--bg-elevated)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-[var(--bg-border)]': variant === 'ghost',
            'bg-[var(--danger)] hover:bg-rose-600 text-white': variant === 'danger',
          },
          {
            'text-xs px-3 h-8': size === 'sm',
            'text-sm px-4 h-10': size === 'md',
            'text-base px-5 h-12': size === 'lg',
          },
          className
        )}
        {...props}
      >
        {loading ? <Spinner size="sm" /> : children}
      </button>
    )
  }
)
Button.displayName = 'Button'
