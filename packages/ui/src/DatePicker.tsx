import { useState, useRef, useEffect, useLayoutEffect, useId } from 'react'
import { createPortal } from 'react-dom'
import {
  format, parse, isValid, addDays,
  startOfMonth, endOfMonth, eachDayOfInterval,
  isSameDay, isSameMonth, addMonths, subMonths,
  startOfWeek, endOfWeek, getYear, getMonth,
} from 'date-fns'
import { ptBR, enUS, type Locale } from 'date-fns/locale'
import { Calendar, ChevronLeft, ChevronRight } from 'lucide-react'
import { clsx } from 'clsx'

type Language = 'pt' | 'en'

function resolveLocale(language: Language): Locale {
  return language === 'en' ? enUS : ptBR
}

// ─── Shared nav button ───────────────────────────────────────────────────────

function NavBtn({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="cursor-pointer h-7 w-7 flex items-center justify-center rounded-[var(--radius-sm)] text-[var(--text-muted)] hover:bg-[var(--bg-elevated)] hover:text-[var(--text-primary)] transition-colors"
    >
      {children}
    </button>
  )
}

// ─── Day calendar ────────────────────────────────────────────────────────────

const REF_SUNDAY = new Date(2023, 0, 1)

function DayCalendar({ selected, onSelect, locale }: {
  selected: Date | undefined
  onSelect: (d: Date) => void
  locale: Locale
}) {
  const today = new Date()
  const [view, setView] = useState(selected ?? today)

  const calDays = eachDayOfInterval({
    start: startOfWeek(startOfMonth(view), { weekStartsOn: 0 }),
    end:   endOfWeek(endOfMonth(view),     { weekStartsOn: 0 }),
  })

  const weekDayHeaders = Array.from({ length: 7 }, (_, i) =>
    format(addDays(REF_SUNDAY, i), 'EEEEE', { locale })
  )

  return (
    <div className="w-64">
      <div className="flex items-center justify-between mb-3">
        <NavBtn onClick={() => setView(v => subMonths(v, 1))}>
          <ChevronLeft className="h-4 w-4" />
        </NavBtn>
        <span className="text-sm font-medium text-[var(--text-primary)] capitalize">
          {format(view, 'MMMM yyyy', { locale })}
        </span>
        <NavBtn onClick={() => setView(v => addMonths(v, 1))}>
          <ChevronRight className="h-4 w-4" />
        </NavBtn>
      </div>

      <div className="grid grid-cols-7 mb-1">
        {weekDayHeaders.map((d, i) => (
          <div key={i} className="text-center text-[10px] text-[var(--text-muted)] font-medium py-1 uppercase">
            {d}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-y-0.5">
        {calDays.map((day) => {
          const sel  = selected && isSameDay(day, selected)
          const curr = isSameMonth(day, view)
          const tod  = isSameDay(day, today)
          return (
            <button
              key={day.toISOString()}
              type="button"
              onClick={() => onSelect(day)}
              className={clsx(
                'h-8 w-full rounded-[var(--radius-sm)] text-xs transition-colors cursor-pointer',
                sel
                  ? 'bg-[var(--accent)] text-white font-semibold'
                  : tod && curr
                  ? 'text-[var(--accent)] font-semibold hover:bg-[var(--bg-elevated)]'
                  : curr
                  ? 'text-[var(--text-primary)] hover:bg-[var(--bg-elevated)]'
                  : 'text-[var(--text-muted)] hover:bg-[var(--bg-elevated)]'
              )}
            >
              {format(day, 'd')}
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ─── Month calendar ──────────────────────────────────────────────────────────

function MonthCalendar({ selected, onSelect, locale }: {
  selected: Date | undefined
  onSelect: (d: Date) => void
  locale: Locale
}) {
  const today = new Date()
  const [year, setYear] = useState(selected ? getYear(selected) : getYear(today))

  const monthNames = Array.from({ length: 12 }, (_, i) =>
    format(new Date(2023, i, 1), 'MMM', { locale }).replace(/^\w/, c => c.toUpperCase())
  )

  return (
    <div className="w-56">
      <div className="flex items-center justify-between mb-3">
        <NavBtn onClick={() => setYear(y => y - 1)}>
          <ChevronLeft className="h-4 w-4" />
        </NavBtn>
        <span className="text-sm font-medium text-[var(--text-primary)]">{year}</span>
        <NavBtn onClick={() => setYear(y => y + 1)}>
          <ChevronRight className="h-4 w-4" />
        </NavBtn>
      </div>

      <div className="grid grid-cols-3 gap-1">
        {monthNames.map((name, i) => {
          const sel  = selected && getMonth(selected) === i && getYear(selected) === year
          const curr = getMonth(today) === i && getYear(today) === year
          return (
            <button
              key={i}
              type="button"
              onClick={() => onSelect(new Date(year, i, 1))}
              className={clsx(
                'h-9 rounded-[var(--radius-sm)] text-xs font-medium transition-colors cursor-pointer',
                sel
                  ? 'bg-[var(--accent)] text-white'
                  : curr
                  ? 'text-[var(--accent)] hover:bg-[var(--bg-elevated)]'
                  : 'text-[var(--text-primary)] hover:bg-[var(--bg-elevated)]'
              )}
            >
              {name}
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ─── Portal popover ──────────────────────────────────────────────────────────
// Renders into document.body via portal so it escapes any overflow:hidden ancestor
// (e.g. modals). Uses fixed positioning calculated from the anchor's bounding rect.

function Popover({ anchorRef, innerRef, children }: {
  anchorRef: React.RefObject<HTMLElement>
  innerRef:  React.RefObject<HTMLDivElement>
  children:  React.ReactNode
}) {
  const [style, setStyle] = useState<React.CSSProperties>({ visibility: 'hidden' })

  useLayoutEffect(() => {
    const anchor = anchorRef.current
    if (!anchor) return

    const rect = anchor.getBoundingClientRect()
    const popoverHeight = 320 // conservative max height
    const spaceBelow = window.innerHeight - rect.bottom

    const left = Math.min(rect.left, window.innerWidth - 280) // prevent right overflow

    if (spaceBelow >= popoverHeight || spaceBelow >= rect.top) {
      setStyle({ position: 'fixed', top: rect.bottom + 4, left, visibility: 'visible' })
    } else {
      // flip above the trigger
      setStyle({ position: 'fixed', bottom: window.innerHeight - rect.top + 4, left, visibility: 'visible' })
    }
  }, [anchorRef])

  return createPortal(
    <div
      ref={innerRef}
      style={style}
      className="z-[9999] p-3 rounded-[var(--radius-md)] border border-[var(--bg-border)] bg-[var(--bg-surface)] shadow-xl select-none"
    >
      {children}
    </div>,
    document.body
  )
}

// ─── Shared trigger button ───────────────────────────────────────────────────

function Trigger({ id, open, disabled, error, label, display, placeholder, size, onClick }: {
  id: string; open: boolean; disabled?: boolean; error?: string
  label?: string; display: string | null; placeholder: string
  size: 'sm' | 'md'; onClick: () => void
}) {
  return (
    <>
      {label && (
        <label htmlFor={id} className="text-xs font-medium text-[var(--text-secondary)]">
          {label}
        </label>
      )}
      <button
        id={id}
        type="button"
        disabled={disabled}
        onClick={onClick}
        className={clsx(
          'w-full rounded-[var(--radius-md)] bg-[var(--bg-elevated)] border text-left transition-colors duration-150 cursor-pointer flex items-center',
          size === 'sm' ? 'h-8 px-2.5 gap-1.5 text-xs' : 'h-10 px-3 gap-2 text-sm',
          error
            ? 'border-[var(--danger)]'
            : open
            ? 'border-[var(--accent)]'
            : 'border-[var(--bg-border)] hover:border-[var(--text-muted)]',
          disabled && 'opacity-50 cursor-not-allowed',
          display ? 'text-[var(--text-primary)]' : 'text-[var(--text-muted)]'
        )}
      >
        <Calendar className={clsx('shrink-0 text-[var(--text-muted)]', size === 'sm' ? 'h-3.5 w-3.5' : 'h-4 w-4')} />
        <span>{display ?? placeholder}</span>
      </button>
    </>
  )
}

// ─── DatePicker ──────────────────────────────────────────────────────────────

interface DatePickerProps {
  value?: string
  onChange?: (value: string) => void
  label?: string
  error?: string
  className?: string
  disabled?: boolean
  placeholder?: string
  language?: Language
  size?: 'sm' | 'md'
}

export function DatePicker({
  value, onChange, label, error, className, disabled, placeholder, language = 'pt', size = 'md',
}: DatePickerProps) {
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const anchorRef    = useRef<HTMLDivElement>(null) as React.RefObject<HTMLDivElement>
  const popoverRef   = useRef<HTMLDivElement>(null) as React.RefObject<HTMLDivElement>
  const id = useId()
  const locale = resolveLocale(language)

  const defaultPlaceholder = language === 'en' ? 'Select date' : 'Selecionar data'
  const displayFormat      = language === 'en' ? 'MM/dd/yyyy' : 'dd/MM/yyyy'

  const parsed   = value ? parse(value, 'yyyy-MM-dd', new Date()) : undefined
  const selected = parsed && isValid(parsed) ? parsed : undefined

  useEffect(() => {
    const h = (e: MouseEvent) => {
      const t = e.target as Node
      if (!containerRef.current?.contains(t) && !popoverRef.current?.contains(t)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  const handleSelect = (date: Date) => {
    onChange?.(format(date, 'yyyy-MM-dd'))
    setOpen(false)
  }

  return (
    <div className={clsx('flex flex-col gap-1.5', className)} ref={containerRef}>
      <div ref={anchorRef}>
        <Trigger
          id={id}
          open={open}
          disabled={disabled}
          error={error}
          label={label}
          display={selected ? format(selected, displayFormat) : null}
          placeholder={placeholder ?? defaultPlaceholder}
          size={size}
          onClick={() => !disabled && setOpen(v => !v)}
        />
      </div>
      {open && (
        <Popover anchorRef={anchorRef} innerRef={popoverRef}>
          <DayCalendar selected={selected} onSelect={handleSelect} locale={locale} />
        </Popover>
      )}
      {error && <span className="text-xs text-[var(--danger)]">{error}</span>}
    </div>
  )
}
DatePicker.displayName = 'DatePicker'

// ─── MonthPicker ─────────────────────────────────────────────────────────────

interface MonthPickerProps {
  value?: string
  onChange?: (value: string) => void
  label?: string
  error?: string
  className?: string
  disabled?: boolean
  placeholder?: string
  language?: Language
  size?: 'sm' | 'md'
}

export function MonthPicker({
  value, onChange, label, error, className, disabled, placeholder, language = 'pt', size = 'md',
}: MonthPickerProps) {
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const anchorRef    = useRef<HTMLDivElement>(null) as React.RefObject<HTMLDivElement>
  const popoverRef   = useRef<HTMLDivElement>(null) as React.RefObject<HTMLDivElement>
  const id = useId()
  const locale = resolveLocale(language)

  const defaultPlaceholder = language === 'en' ? 'Select month' : 'Selecionar mês'

  const parsed   = value ? parse(value, 'yyyy-MM', new Date()) : undefined
  const selected = parsed && isValid(parsed) ? parsed : undefined

  useEffect(() => {
    const h = (e: MouseEvent) => {
      const t = e.target as Node
      if (!containerRef.current?.contains(t) && !popoverRef.current?.contains(t)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  const handleSelect = (date: Date) => {
    onChange?.(format(date, 'yyyy-MM'))
    setOpen(false)
  }

  const display = selected
    ? format(selected, 'MMM yyyy', { locale }).replace(/^\w/, c => c.toUpperCase())
    : null

  return (
    <div className={clsx('flex flex-col gap-1.5', className)} ref={containerRef}>
      <div ref={anchorRef}>
        <Trigger
          id={id}
          open={open}
          disabled={disabled}
          error={error}
          label={label}
          display={display}
          placeholder={placeholder ?? defaultPlaceholder}
          size={size}
          onClick={() => !disabled && setOpen(v => !v)}
        />
      </div>
      {open && (
        <Popover anchorRef={anchorRef} innerRef={popoverRef}>
          <MonthCalendar selected={selected} onSelect={handleSelect} locale={locale} />
        </Popover>
      )}
      {error && <span className="text-xs text-[var(--danger)]">{error}</span>}
    </div>
  )
}
MonthPicker.displayName = 'MonthPicker'
