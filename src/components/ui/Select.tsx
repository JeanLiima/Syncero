import { type SelectHTMLAttributes, forwardRef } from 'react'
import { clsx } from 'clsx'

interface SelectOption {
  value: string
  label: string
}

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string
  error?: string
  options: SelectOption[]
  placeholder?: string
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, error, options, placeholder, className, id, ...props }, ref) => {
    const selectId = id ?? label?.toLowerCase().replace(/\s/g, '-')
    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label htmlFor={selectId} className="text-xs font-medium text-[var(--text-secondary)]">
            {label}
          </label>
        )}
        <select
          ref={ref}
          id={selectId}
          className={clsx(
            'h-10 px-3 rounded-[var(--radius-md)] bg-[var(--bg-elevated)] border text-sm text-[var(--text-primary)] outline-none transition-colors duration-150 cursor-pointer',
            error
              ? 'border-[var(--danger)] focus:border-[var(--danger)]'
              : 'border-[var(--bg-border)] focus:border-[var(--accent)]',
            className
          )}
          {...props}
        >
          {placeholder && <option value="">{placeholder}</option>}
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
        {error && <span className="text-xs text-[var(--danger)]">{error}</span>}
      </div>
    )
  }
)
Select.displayName = 'Select'
