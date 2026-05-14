import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { UserPlus } from 'lucide-react'
import { maskCnpj } from '@/lib/cnpj'
import type { Contact } from '@/types'

interface ContactComboboxProps {
  value: string
  onChange: (name: string, contact?: Contact) => void
  onAddNew: (query: string) => void
  onConfirm?: () => void
  contacts: Contact[]
  placeholder: string
  addLabel: string
  autoFocus?: boolean
}

export function ContactCombobox({
  value,
  onChange,
  onAddNew,
  onConfirm,
  contacts,
  placeholder,
  addLabel,
  autoFocus = true,
}: ContactComboboxProps) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState(value)
  const [highlightedIndex, setHighlightedIndex] = useState(-1)
  const [dropdownRect, setDropdownRect] = useState<DOMRect | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  const filtered = query.trim()
    ? contacts.filter((c) =>
        c.name.toLowerCase().includes(query.toLowerCase()) ||
        (c.cpf ?? '').replace(/\D/g, '').includes(query.replace(/\D/g, '')) ||
        (c.cnpj ?? '').replace(/\D/g, '').includes(query.replace(/\D/g, ''))
      )
    : contacts

  const showAddNew = query.trim().length > 0 &&
    !contacts.some((c) => c.name.toLowerCase() === query.trim().toLowerCase())

  const totalItems = filtered.length + (showAddNew ? 1 : 0)
  const showDropdown = open && totalItems > 0

  useEffect(() => { setQuery(value) }, [value])
  useEffect(() => { setHighlightedIndex(-1) }, [query])

  // Update dropdown position whenever it opens or window resizes/scrolls
  useEffect(() => {
    if (!open || !inputRef.current) { setDropdownRect(null); return }
    const update = () => {
      if (inputRef.current) setDropdownRect(inputRef.current.getBoundingClientRect())
    }
    update()
    window.addEventListener('scroll', update, true)
    window.addEventListener('resize', update)
    return () => {
      window.removeEventListener('scroll', update, true)
      window.removeEventListener('resize', update)
    }
  }, [open])

  useEffect(() => {
    const h = (e: MouseEvent) => {
      const target = e.target as Node
      const inContainer = containerRef.current?.contains(target)
      const inList = listRef.current?.contains(target)
      if (!inContainer && !inList) setOpen(false)
    }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  // Scroll highlighted item into view
  useEffect(() => {
    if (!listRef.current || highlightedIndex < 0) return
    const items = listRef.current.querySelectorAll('[data-item]')
    items[highlightedIndex]?.scrollIntoView({ block: 'nearest' })
  }, [highlightedIndex])

  const commit = (contact: Contact) => {
    onChange(contact.name, contact)
    setQuery(contact.name)
    setOpen(false)
  }

  const formatDoc = (c: Contact) => {
    if (c.cpf) return `CPF ${c.cpf}`
    if (c.cnpj) return `CNPJ ${maskCnpj(c.cnpj)}`
    return null
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setOpen(true)
      setHighlightedIndex((i) => Math.min(i + 1, totalItems - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlightedIndex((i) => Math.max(i - 1, 0))
    } else if (e.key === 'Escape') {
      setOpen(false)
      setHighlightedIndex(-1)
    } else if (e.key === 'Enter') {
      e.preventDefault()
      e.stopPropagation()
      if (showDropdown) {
        if (highlightedIndex >= 0 && highlightedIndex < filtered.length) {
          commit(filtered[highlightedIndex])
        } else if (highlightedIndex === filtered.length && showAddNew) {
          onAddNew(query.trim())
          setOpen(false)
        } else if (filtered.length === 1) {
          commit(filtered[0])
        } else if (filtered.length === 0 && showAddNew) {
          onAddNew(query.trim())
          setOpen(false)
        }
      } else if (value.trim()) {
        onConfirm?.()
      }
    }
  }

  const dropdown = showDropdown && dropdownRect && createPortal(
    <div
      ref={listRef}
      style={{
        position: 'fixed',
        top: dropdownRect.bottom + 4,
        left: dropdownRect.left,
        width: dropdownRect.width,
        zIndex: 9999,
      }}
      className="rounded-[var(--radius-md)] border border-[var(--bg-border)] bg-[var(--bg-surface)] shadow-lg overflow-hidden max-h-52 overflow-y-auto"
    >
      {filtered.map((c, i) => (
        <button
          key={c.id}
          type="button"
          data-item
          onMouseDown={(e) => { e.preventDefault(); commit(c) }}
          className={`w-full text-left px-3 py-2.5 transition-colors hover:bg-[var(--bg-elevated)] cursor-pointer ${
            i === highlightedIndex || c.name === value ? 'bg-[var(--bg-elevated)]' : ''
          }`}
        >
          <p className={`text-sm ${c.name === value ? 'text-[var(--accent)]' : 'text-[var(--text-primary)]'}`}>
            {c.name}
          </p>
          {formatDoc(c) && (
            <p className="text-xs text-[var(--text-muted)] mt-0.5">{formatDoc(c)}</p>
          )}
        </button>
      ))}
      {showAddNew && (
        <button
          type="button"
          data-item
          onMouseDown={(e) => { e.preventDefault(); onAddNew(query.trim()) }}
          className={`w-full text-left px-3 py-2.5 text-sm text-[var(--accent)] hover:bg-[var(--bg-elevated)] cursor-pointer flex items-center gap-2 border-t border-[var(--bg-border)] ${
            highlightedIndex === filtered.length ? 'bg-[var(--bg-elevated)]' : ''
          }`}
        >
          <UserPlus className="h-3.5 w-3.5 shrink-0" />
          {addLabel} &ldquo;{query.trim()}&rdquo;
        </button>
      )}
    </div>,
    document.body
  )

  return (
    <div ref={containerRef} className="relative">
      <input
        ref={inputRef}
        type="text"
        value={query}
        placeholder={placeholder}
        autoFocus={autoFocus}
        onChange={(e) => {
          setQuery(e.target.value)
          onChange(e.target.value)
          setOpen(true)
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={handleKeyDown}
        className="w-full h-10 px-3 rounded-[var(--radius-md)] bg-[var(--bg-elevated)] border border-[var(--bg-border)] text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--accent)] transition-colors"
      />
      {dropdown}
    </div>
  )
}