import { useState, useRef, useEffect, useId } from 'react'
import { ChevronDown, Check } from 'lucide-react'
import { clsx } from 'clsx'

interface SelectOption {
  value: string
  label: string
}

interface SelectProps {
  options: SelectOption[]
  value?: string
  onChange?: (value: string) => void
  label?: string
  error?: string
  placeholder?: string
  disabled?: boolean
  className?: string
  name?: string
  onBlur?: () => void
}

export function Select({
  options,
  value,
  onChange,
  label,
  error,
  placeholder = 'Selecionar',
  disabled,
  className,
  onBlur,
}: SelectProps) {
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const id = useId()

  const selected = options.find((o) => o.value === value)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
        onBlur?.()
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [onBlur])

  const handleSelect = (optValue: string) => {
    onChange?.(optValue)
    setOpen(false)
    onBlur?.()
  }

  return (
    <div className={clsx('flex flex-col gap-1.5', className)} ref={containerRef}>
      {label && (
        <label htmlFor={id} className="text-xs font-medium text-[var(--text-secondary)]">
          {label}
        </label>
      )}

      <div className="relative">
        <button
          id={id}
          type="button"
          disabled={disabled}
          onClick={() => !disabled && setOpen((v) => !v)}
          className={clsx(
            'w-full h-10 px-3 pr-9 rounded-[var(--radius-md)] bg-[var(--bg-elevated)] border text-sm text-left transition-colors duration-150 cursor-pointer flex items-center',
            error
              ? 'border-[var(--danger)] focus:border-[var(--danger)]'
              : open
              ? 'border-[var(--accent)]'
              : 'border-[var(--bg-border)] hover:border-[var(--text-muted)]',
            disabled && 'opacity-50 cursor-not-allowed',
            selected ? 'text-[var(--text-primary)]' : 'text-[var(--text-muted)]'
          )}
        >
          <span className="truncate">{selected?.label ?? placeholder}</span>
          <ChevronDown
            className={clsx(
              'absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--text-muted)] transition-transform duration-150',
              open && 'rotate-180'
            )}
          />
        </button>

        {open && (
          <div className="absolute z-50 mt-1 w-full rounded-[var(--radius-md)] border border-[var(--bg-border)] bg-[var(--bg-surface)] shadow-lg py-1 animate-in">
            {options.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => handleSelect(opt.value)}
                className={clsx(
                  'w-full flex items-center justify-between px-3 py-2 text-sm text-left transition-colors cursor-pointer',
                  opt.value === value
                    ? 'text-[var(--accent)] bg-[var(--accent-subtle)]'
                    : 'text-[var(--text-primary)] hover:bg-[var(--bg-elevated)]'
                )}
              >
                <span>{opt.label}</span>
                {opt.value === value && <Check className="h-3.5 w-3.5 flex-shrink-0" />}
              </button>
            ))}
          </div>
        )}
      </div>

      {error && <span className="text-xs text-[var(--danger)]">{error}</span>}
    </div>
  )
}
