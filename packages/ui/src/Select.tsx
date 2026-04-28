import { useState, useRef, useEffect, useId } from 'react'
import { ChevronDown, Check, Search } from 'lucide-react'
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
  size?: 'sm' | 'md'
  onBlur?: () => void
  searchable?: boolean
  searchPlaceholder?: string
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
  size = 'md',
  onBlur,
  searchable = false,
  searchPlaceholder = 'Buscar…',
}: SelectProps) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const containerRef = useRef<HTMLDivElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)
  const id = useId()

  const selected = options.find((o) => o.value === value)

  const filtered = searchable && query
    ? options.filter((o) => o.label.toLowerCase().includes(query.toLowerCase()))
    : options

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
        setQuery('')
        onBlur?.()
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [onBlur])

  useEffect(() => {
    if (open && searchable) {
      setTimeout(() => searchRef.current?.focus(), 0)
    }
    if (!open) setQuery('')
  }, [open, searchable])

  const handleSelect = (optValue: string) => {
    onChange?.(optValue)
    setOpen(false)
    setQuery('')
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
            'w-full rounded-[var(--radius-md)] bg-[var(--bg-elevated)] border text-left transition-colors duration-150 cursor-pointer flex items-center',
            size === 'sm' ? 'h-8 px-2.5 pr-8 text-xs' : 'h-10 px-3 pr-9 text-sm',
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
              'absolute top-1/2 -translate-y-1/2 text-[var(--text-muted)] transition-transform duration-150',
              size === 'sm' ? 'right-2 h-3.5 w-3.5' : 'right-3 h-4 w-4',
              open && 'rotate-180'
            )}
          />
        </button>

        {open && (
          <div className="absolute z-50 mt-1 w-full rounded-[var(--radius-md)] border border-[var(--bg-border)] bg-[var(--bg-surface)] shadow-lg animate-in overflow-hidden">
            {searchable && (
              <div className="flex items-center gap-2 px-3 py-2 border-b border-[var(--bg-border)]">
                <Search className="h-3.5 w-3.5 text-[var(--text-muted)] shrink-0" />
                <input
                  ref={searchRef}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={searchPlaceholder}
                  className="flex-1 bg-transparent text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] outline-none"
                />
              </div>
            )}
            <div className="py-1 max-h-56 overflow-y-auto">
              {filtered.length === 0 ? (
                <p className="px-3 py-2 text-sm text-[var(--text-muted)]">Nenhum resultado</p>
              ) : (
                filtered.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => handleSelect(opt.value)}
                    className={clsx(
                      'w-full flex items-center justify-between px-3 py-2 text-sm text-left transition-colors cursor-pointer',
                      opt.value === value
                        ? 'bg-[var(--accent)] text-white'
                        : 'text-[var(--text-primary)] hover:bg-[var(--bg-elevated)]'
                    )}
                  >
                    <span>{opt.label}</span>
                    {opt.value === value && <Check className="h-3.5 w-3.5 flex-shrink-0" />}
                  </button>
                ))
              )}
            </div>
          </div>
        )}
      </div>

      {error && <span className="text-xs text-[var(--danger)]">{error}</span>}
    </div>
  )
}
