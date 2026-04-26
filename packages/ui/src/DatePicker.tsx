import { useState, useRef, useEffect, useLayoutEffect, useId } from 'react'
import { createPortal } from 'react-dom'
import {
  format, parse, isValid, addDays,
  startOfMonth, endOfMonth, eachDayOfInterval,
  isSameDay, isSameMonth, addMonths, subMonths,
  startOfWeek, endOfWeek, getYear, getMonth,
  isAfter, isBefore,
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

export function DayCalendar({ selected, onSelect, locale }: {
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

// ─── Range day calendar ──────────────────────────────────────────────────────

function RangeDayCalendar({ from, to, onSelect, locale }: {
  from: Date | undefined
  to: Date | undefined
  onSelect: (d: Date) => void
  locale: Locale
}) {
  const today = new Date()
  const [view, setView] = useState(from ?? today)
  const [hovered, setHovered] = useState<Date | undefined>()

  const leftStart  = startOfMonth(view)
  const rightStart = startOfMonth(addMonths(view, 1))

  // Effective range including hover preview when only `from` is set
  const effectiveEnd = !to ? hovered : to
  const rangeFrom = from && effectiveEnd
    ? (isBefore(from, effectiveEnd) || isSameDay(from, effectiveEnd) ? from : effectiveEnd)
    : undefined
  const rangeTo = from && effectiveEnd
    ? (isBefore(from, effectiveEnd) || isSameDay(from, effectiveEnd) ? effectiveEnd : from)
    : undefined

  const weekDayHeaders = Array.from({ length: 7 }, (_, i) =>
    format(addDays(REF_SUNDAY, i), 'EEEEE', { locale })
  )

  function renderMonth(monthStart: Date) {
    const calDays = eachDayOfInterval({
      start: startOfWeek(monthStart, { weekStartsOn: 0 }),
      end:   endOfWeek(endOfMonth(monthStart), { weekStartsOn: 0 }),
    })

    return (
      <div className="w-60">
        <div className="text-sm font-medium text-center mb-3 text-[var(--text-primary)] capitalize">
          {format(monthStart, 'MMMM yyyy', { locale })}
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
            const isFrom     = from && isSameDay(day, from)
            const isTo       = to   && isSameDay(day, to)
            const isEndpoint = isFrom || isTo
            const inRange    = rangeFrom && rangeTo
              && isAfter(day, rangeFrom) && isBefore(day, rangeTo)
            const curr = isSameMonth(day, monthStart)
            const tod  = isSameDay(day, today)
            return (
              <button
                key={day.toISOString()}
                type="button"
                onClick={() => onSelect(day)}
                onMouseEnter={() => setHovered(day)}
                onMouseLeave={() => setHovered(undefined)}
                className={clsx(
                  'h-8 w-full text-xs transition-colors cursor-pointer rounded-[var(--radius-sm)]',
                  isEndpoint
                    ? 'bg-[var(--accent)] text-white font-semibold'
                    : inRange
                    ? 'bg-[var(--accent)]/15 text-[var(--text-primary)]'
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

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <NavBtn onClick={() => setView(v => subMonths(v, 1))}>
          <ChevronLeft className="h-4 w-4" />
        </NavBtn>
        <NavBtn onClick={() => setView(v => addMonths(v, 1))}>
          <ChevronRight className="h-4 w-4" />
        </NavBtn>
      </div>
      <div className="flex gap-6">
        {renderMonth(leftStart)}
        {renderMonth(rightStart)}
      </div>
    </div>
  )
}

// ─── Portal popover ──────────────────────────────────────────────────────────

function Popover({ anchorRef, innerRef, children }: {
  anchorRef: React.RefObject<HTMLElement>
  innerRef:  React.RefObject<HTMLDivElement>
  children:  React.ReactNode
}) {
  const [style, setStyle] = useState<React.CSSProperties>({ visibility: 'hidden' })

  useLayoutEffect(() => {
    const anchor  = anchorRef.current
    const popover = innerRef.current
    if (!anchor || !popover) return

    const rect = anchor.getBoundingClientRect()
    const pw   = popover.offsetWidth  || 300
    const ph   = popover.offsetHeight || 320

    let left = rect.left
    if (left + pw > window.innerWidth - 8) left = window.innerWidth - pw - 8
    left = Math.max(8, left)

    const spaceBelow = window.innerHeight - rect.bottom
    if (spaceBelow >= ph || spaceBelow >= rect.top) {
      setStyle({ position: 'fixed', top: rect.bottom + 4, left, visibility: 'visible' })
    } else {
      setStyle({ position: 'fixed', bottom: window.innerHeight - rect.top + 4, left, visibility: 'visible' })
    }
  }, [anchorRef, innerRef])

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

// ─── DateRangePicker ─────────────────────────────────────────────────────────

interface DateRangePickerProps {
  from?: string
  to?: string
  onChange: (from: string, to: string) => void
  label?: string
  className?: string
  disabled?: boolean
  placeholder?: string
  language?: Language
  size?: 'sm' | 'md'
}

export function DateRangePicker({
  from, to, onChange, label, className, disabled, placeholder, language = 'pt', size = 'md',
}: DateRangePickerProps) {
  const [open, setOpen] = useState(false)
  const [pickFrom, setPickFrom] = useState<Date | undefined>()
  const [pickTo,   setPickTo]   = useState<Date | undefined>()
  const containerRef = useRef<HTMLDivElement>(null)
  const anchorRef    = useRef<HTMLDivElement>(null) as React.RefObject<HTMLDivElement>
  const popoverRef   = useRef<HTMLDivElement>(null) as React.RefObject<HTMLDivElement>
  const id = useId()
  const locale = resolveLocale(language)

  const displayFormat      = language === 'en' ? 'MM/dd/yyyy' : 'dd/MM/yyyy'
  const defaultPlaceholder = language === 'en' ? 'Select period' : 'Selecionar período'

  const parsedFrom = from ? parse(from, 'yyyy-MM-dd', new Date()) : undefined
  const parsedTo   = to   ? parse(to,   'yyyy-MM-dd', new Date()) : undefined
  const selFrom = parsedFrom && isValid(parsedFrom) ? parsedFrom : undefined
  const selTo   = parsedTo   && isValid(parsedTo)   ? parsedTo   : undefined

  // Keep internal pick state in sync with controlled props
  useEffect(() => { setPickFrom(selFrom) }, [from]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { setPickTo(selTo) },     [to])   // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const h = (e: MouseEvent) => {
      const t = e.target as Node
      if (!containerRef.current?.contains(t) && !popoverRef.current?.contains(t)) {
        setOpen(false)
        // Reset incomplete selection on close
        setPickFrom(selFrom)
        setPickTo(selTo)
      }
    }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [selFrom, selTo])

  const handleSelect = (date: Date) => {
    if (!pickFrom || (pickFrom && pickTo)) {
      // Start new selection
      setPickFrom(date)
      setPickTo(undefined)
    } else {
      // Complete selection — ensure from < to
      const [f, t] = isBefore(date, pickFrom) || isSameDay(date, pickFrom)
        ? [date, pickFrom]
        : [pickFrom, date]
      onChange(format(f, 'yyyy-MM-dd'), format(t, 'yyyy-MM-dd'))
      setOpen(false)
    }
  }

  const display = selFrom && selTo
    ? `${format(selFrom, displayFormat)} → ${format(selTo, displayFormat)}`
    : selFrom
    ? format(selFrom, displayFormat)
    : null

  const hint = open && pickFrom && !pickTo
    ? (language === 'en' ? 'Select end date' : 'Selecione a data final')
    : null

  return (
    <div className={clsx('flex flex-col gap-1.5', className)} ref={containerRef}>
      <div ref={anchorRef}>
        <Trigger
          id={id}
          open={open}
          disabled={disabled}
          label={label}
          display={display}
          placeholder={placeholder ?? defaultPlaceholder}
          size={size}
          onClick={() => !disabled && setOpen(v => !v)}
        />
      </div>
      {open && (
        <Popover anchorRef={anchorRef} innerRef={popoverRef}>
          <RangeDayCalendar
            from={pickFrom}
            to={pickTo}
            onSelect={handleSelect}
            locale={locale}
          />
          {hint && (
            <p className="text-xs text-[var(--text-muted)] mt-3 text-center">{hint}</p>
          )}
        </Popover>
      )}
    </div>
  )
}
DateRangePicker.displayName = 'DateRangePicker'
