import { forwardRef, useEffect, useRef, type InputHTMLAttributes } from 'react'
import { clsx } from 'clsx'

interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label?: string
  error?: string
  indeterminate?: boolean
}

export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(
  ({ label, error, className, disabled, indeterminate, ...props }, ref) => {
    const innerRef = useRef<HTMLInputElement>(null)

    useEffect(() => {
      const el = (ref && typeof ref === 'object' ? ref.current : null) ?? innerRef.current
      if (el) el.indeterminate = !!indeterminate
    }, [indeterminate, ref])

    return (
      <div className={clsx('flex flex-col gap-1', className)}>
        <label
          className={clsx(
            'flex items-center gap-2.5 select-none w-fit',
            disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer group',
          )}
        >
          <div className="relative flex-shrink-0">
            <input
              ref={ref ?? innerRef}
              type="checkbox"
              disabled={disabled}
              className="peer sr-only"
              {...props}
            />
            {/* Box */}
            <div
              className={clsx(
                'h-4.5 w-4.5 rounded-[4px] border transition-all duration-150',
                'bg-[var(--bg-elevated)] border-[var(--bg-border)]',
                indeterminate
                  ? 'bg-[var(--accent)] border-[var(--accent)]'
                  : 'peer-checked:bg-[var(--accent)] peer-checked:border-[var(--accent)]',
                !disabled && 'group-hover:border-[var(--text-muted)]',
                error && 'border-[var(--danger)] peer-checked:bg-[var(--danger)] peer-checked:border-[var(--danger)]',
              )}
            />
            {/* Checkmark */}
            {!indeterminate && (
              <svg
                viewBox="0 0 10 8"
                fill="none"
                className="pointer-events-none absolute inset-0 m-auto h-2.5 w-2.5 text-white opacity-0 transition-opacity duration-150 peer-checked:opacity-100"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M1 4l2.5 2.5L9 1" />
              </svg>
            )}
            {/* Indeterminate dash */}
            {indeterminate && (
              <span className="pointer-events-none absolute inset-0 m-auto h-0.5 w-2.5 bg-white rounded-full" />
            )}
          </div>

          {label && (
            <span className="text-sm text-[var(--text-secondary)] leading-none">{label}</span>
          )}
        </label>

        {error && <span className="text-xs text-[var(--danger)]">{error}</span>}
      </div>
    )
  }
)

Checkbox.displayName = 'Checkbox'
