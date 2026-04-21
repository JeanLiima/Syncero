import { type InputHTMLAttributes, forwardRef } from 'react'
import { clsx } from 'clsx'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, className, id, ...props }, ref) => {
    const inputId = id ?? label?.toLowerCase().replace(/\s/g, '-')
    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label htmlFor={inputId} className="text-xs font-medium text-[var(--text-secondary)]">
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          className={clsx(
            'h-10 px-3 rounded-[var(--radius-md)] bg-[var(--bg-elevated)] border text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] outline-none transition-colors duration-150',
            error
              ? 'border-[var(--danger)] focus:border-[var(--danger)]'
              : 'border-[var(--bg-border)] focus:border-[var(--accent)]',
            className
          )}
          {...props}
        />
        {error && <span className="text-xs text-[var(--danger)]">{error}</span>}
      </div>
    )
  }
)
Input.displayName = 'Input'
