import { useEffect, useRef, useState } from 'react'
import { TrendingUp, TrendingDown, UserPlus, Repeat } from 'lucide-react'
import { Button, DatePicker, Input, Modal, Select, useToast } from '@syncero/ui'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useT } from '@/i18n'
import { useCategories, useContacts } from './queries'
import { useUpdateTransaction, useDeleteTransaction } from './mutations'
import { createContact } from '@/lib/backend'
import { useAuthStore } from '@/store/auth'
import type { Transaction, TransactionType, Contact } from '@/types'

// ── Quick-add contact modal ──────────────────────────────────

function ContactModal({
  open,
  onClose,
  onCreated,
  initialName,
}: {
  open: boolean
  onClose: () => void
  onCreated: (contact: Contact) => void
  initialName: string
}) {
  const t = useT()
  const qc = useQueryClient()
  const activeCompany = useAuthStore((s) => s.activeCompany)
  const [name, setName] = useState(initialName)
  const [cpf, setCpf] = useState('')
  const [cnpj, setCnpj] = useState('')

  useEffect(() => { if (open) { setName(initialName); setCpf(''); setCnpj('') } }, [open])

  const save = useMutation({
    mutationFn: () => createContact({
      company_id: activeCompany!.id,
      name: name.trim(),
      cpf: cpf.trim() || undefined,
      cnpj: cnpj.trim() || undefined,
    }),
    onSuccess: (contact) => {
      qc.invalidateQueries({ queryKey: ['contacts', activeCompany?.id] })
      onCreated(contact)
    },
  })

  return (
    <Modal open={open} onClose={onClose} title={t('contact_newTitle')} size="sm">
      <div className="flex flex-col gap-4">
        <Input
          label={t('contact_name')}
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && name.trim() && !save.isPending) save.mutate() }}
          autoFocus
        />
        <div className="grid grid-cols-2 gap-3">
          <Input
            label={`${t('contact_cpf')} (${t('transactions_wizard_optional')})`}
            value={cpf}
            onChange={(e) => setCpf(e.target.value)}
            placeholder="000.000.000-00"
          />
          <Input
            label={`${t('contact_cnpj')} (${t('transactions_wizard_optional')})`}
            value={cnpj}
            onChange={(e) => setCnpj(e.target.value)}
            placeholder="00.000.000/0000-00"
          />
        </div>
      </div>
      <div className="flex items-center justify-end gap-3 mt-6 pt-4 border-t border-[var(--bg-border)]">
        <Button variant="ghost" size="sm" onClick={onClose}>{t('contact_cancel')}</Button>
        <Button onClick={() => save.mutate()} loading={save.isPending} disabled={!name.trim()}>
          {t('contact_save')}
        </Button>
      </div>
    </Modal>
  )
}

// ── Contact combobox ─────────────────────────────────────────

function ContactCombobox({
  value,
  onChange,
  onAddNew,
  contacts,
  placeholder,
  addLabel,
}: {
  value: string
  onChange: (name: string, contact?: Contact) => void
  onAddNew: (query: string) => void
  contacts: Contact[]
  placeholder: string
  addLabel: string
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState(value)
  const [highlightedIndex, setHighlightedIndex] = useState(-1)
  const containerRef = useRef<HTMLDivElement>(null)
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

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

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
    if (c.cnpj) return `CNPJ ${c.cnpj}`
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
      }
    }
  }

  return (
    <div ref={containerRef} className="relative">
      <input
        type="text"
        value={query}
        placeholder={placeholder}
        onChange={(e) => {
          setQuery(e.target.value)
          onChange(e.target.value)
          setOpen(true)
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={handleKeyDown}
        className="w-full h-10 px-3 rounded-[var(--radius-md)] bg-[var(--bg-elevated)] border border-[var(--bg-border)] text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--accent)] transition-colors"
      />
      {showDropdown && (
        <div ref={listRef} className="absolute z-10 w-full mt-1 rounded-[var(--radius-md)] border border-[var(--bg-border)] bg-[var(--bg-surface)] shadow-lg overflow-hidden max-h-52 overflow-y-auto">
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
              {formatDoc(c) && <p className="text-xs text-[var(--text-muted)] mt-0.5">{formatDoc(c)}</p>}
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
        </div>
      )}
    </div>
  )
}

// ── Label wrapper ────────────────────────────────────────────

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <span className="text-sm font-medium text-[var(--text-secondary)]">{children}</span>
}

// ── Edit modal ───────────────────────────────────────────────

interface Props {
  transaction: Transaction | null
  open: boolean
  onClose: () => void
  language: 'pt' | 'en'
}

export function TransactionEditModal({ transaction, open, onClose, language }: Props) {
  const t = useT()
  const { success, error: toastError } = useToast()
  const update = useUpdateTransaction()
  const deleteT = useDeleteTransaction()
  const { data: categories = [] } = useCategories()
  const [contactSearch, setContactSearch] = useState('')
  const { data: contacts = [] } = useContacts(contactSearch)

  const [type, setType] = useState<TransactionType>('expense')
  const [date, setDate] = useState('')
  const [amountCents, setAmountCents] = useState(0)
  const [categoryId, setCategoryId] = useState('')
  const [description, setDescription] = useState('')
  const [notes, setNotes] = useState('')
  const [counterpart, setCounterpart] = useState('')
  const [contactId, setContactId] = useState<string | undefined>()
  const [descError, setDescError] = useState('')
  const [amountError, setAmountError] = useState('')

  const [confirmDelete, setConfirmDelete] = useState(false)
  const [contactModalOpen, setContactModalOpen] = useState(false)
  const [contactModalInitialName, setContactModalInitialName] = useState('')

  const amountRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!open || !transaction) return
    setType(transaction.type)
    setDate(transaction.date)
    setAmountCents(Math.round(transaction.amount * 100))
    setCategoryId(transaction.category_id ?? '')
    setDescription(transaction.description ?? '')
    setNotes(transaction.notes ?? '')
    setCounterpart(transaction.contacts?.name ?? transaction.counterpart ?? '')
    setContactId(transaction.contact_id ?? undefined)
    setContactSearch('')
    setDescError('')
    setAmountError('')
    setConfirmDelete(false)
  }, [open])

  const formatCents = (cents: number) => {
    const padded = String(cents).padStart(3, '0')
    return padded.slice(0, -2) + ',' + padded.slice(-2)
  }

  const handleAmountKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key >= '0' && e.key <= '9') {
      e.preventDefault()
      const digit = parseInt(e.key)
      setAmountCents((prev) => (prev * 10 + digit > 9999999 ? prev : prev * 10 + digit))
      setAmountError('')
    } else if (e.key === 'Backspace') {
      e.preventDefault()
      setAmountCents((prev) => Math.floor(prev / 10))
    } else if (!['Tab', 'ArrowLeft', 'ArrowRight', 'Enter'].includes(e.key)) {
      e.preventDefault()
    }
  }

  const handleSave = async () => {
    if (!transaction) return
    setDescError('')
    setAmountError('')
    if (!description.trim()) { setDescError(t('transactions_errorDescription')); return }
    if (amountCents <= 0) { setAmountError(t('transactions_errorAmount')); amountRef.current?.focus(); return }

    try {
    await update.mutateAsync({
      id: transaction.id,
      data: {
        type,
        date,
        amount: amountCents / 100,
        category_id: categoryId || null,
        description: description.trim(),
        notes: notes.trim() || null,
        counterpart: counterpart.trim() || null,
        contact_id: contactId ?? null,
        is_paid: transaction.is_paid,
        is_installment: transaction.is_installment,
        installment_count: transaction.installment_count ?? null,
        installment_number: transaction.installment_number ?? null,
        installment_group_id: transaction.installment_group_id ?? null,
      },
    })
    success(t('common_savedSuccess'))
    onClose()
    } catch {
      toastError(t('common_errorGeneric'))
    }
  }

  const handleDelete = async () => {
    if (!transaction) return
    try {
      await deleteT.mutateAsync(transaction.id)
      success(t('common_deletedSuccess'))
      onClose()
    } catch {
      toastError(t('common_errorGeneric'))
    }
  }

  const filteredCategories = categories.filter((c) => c.type === type)

  const footer = confirmDelete ? (
    <div className="flex items-center justify-between">
      <span className="text-sm text-[var(--text-secondary)]">{t('transactions_deleteConfirm')}</span>
      <div className="flex gap-2">
        <Button variant="ghost" size="sm" onClick={() => setConfirmDelete(false)}>
          {t('transactions_cancel')}
        </Button>
        <Button variant="danger" size="sm" onClick={handleDelete} loading={deleteT.isPending}>
          {t('transactions_deleteConfirmYes')}
        </Button>
      </div>
    </div>
  ) : (
    <div className="flex items-center justify-between">
      <Button variant="danger" size="sm" onClick={() => setConfirmDelete(true)}>
        {t('transactions_delete')}
      </Button>
      <div className="flex gap-2">
        <Button variant="ghost" size="sm" onClick={onClose}>
          {t('transactions_cancel')}
        </Button>
        <Button onClick={handleSave} loading={update.isPending} disabled={!description.trim() || amountCents <= 0}>
          {t('transactions_save')}
        </Button>
      </div>
    </div>
  )

  return (
    <>
      <Modal open={open} onClose={onClose} title={t('transactions_editTitle')} size="md" footer={footer}>
        <div className="flex flex-col gap-5">

          {/* Type */}
          <div className="flex flex-col gap-2">
            <FieldLabel>{t('transactions_type')}</FieldLabel>
            <div className="grid grid-cols-2 gap-2">
              {([['income', TrendingUp], ['expense', TrendingDown]] as const).map(([v, Icon]) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => { setType(v); setCategoryId('') }}
                  className={`flex items-center justify-center gap-2 py-2.5 rounded-lg border-2 text-sm font-medium transition-all cursor-pointer ${
                    type === v
                      ? v === 'income'
                        ? 'border-[var(--success)] bg-[var(--success)]/10 text-[var(--success)]'
                        : 'border-[var(--danger)] bg-[var(--danger)]/10 text-[var(--danger)]'
                      : 'border-[var(--bg-border)] text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)]'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {v === 'income' ? t('transactions_income_badge') : t('transactions_expense_badge')}
                </button>
              ))}
            </div>
          </div>

          {/* Date + Amount */}
          <div className="grid grid-cols-2 gap-3">
            <DatePicker
              label={t('transactions_competencyDate')}
              value={date}
              onChange={setDate}
              language={language}
            />
            <div className="flex flex-col gap-1.5">
              <FieldLabel>{t('transactions_amount')}</FieldLabel>
              <div className={`flex items-center gap-1.5 h-10 px-3 rounded-[var(--radius-md)] bg-[var(--bg-elevated)] border transition-colors ${
                amountError ? 'border-[var(--danger)]' : 'border-[var(--bg-border)] focus-within:border-[var(--accent)]'
              }`}>
                <span className="text-sm text-[var(--text-muted)] shrink-0">R$</span>
                <input
                  ref={amountRef}
                  type="text"
                  inputMode="numeric"
                  value={formatCents(amountCents)}
                  onChange={() => {}}
                  onKeyDown={handleAmountKey}
                  className="flex-1 bg-transparent text-sm text-[var(--text-primary)] text-right outline-none font-mono min-w-0"
                />
              </div>
              {amountError && <p className="text-xs text-[var(--danger)]">{amountError}</p>}
            </div>
          </div>

          {/* Category */}
          <Select
            label={`${t('transactions_category')} (${t('transactions_wizard_optional')})`}
            placeholder={t('transactions_noCategory')}
            value={categoryId}
            onChange={setCategoryId}
            options={filteredCategories.map((c) => ({ value: c.id, label: c.name }))}
          />

          {/* Counterpart / Contact */}
          <div className="flex flex-col gap-1.5">
            <FieldLabel>
              {type === 'income'
                ? t('transactions_wizard_counterpartIncomeLabel')
                : t('transactions_wizard_counterpartExpenseLabel')}
              <span className="ml-1.5 text-xs font-normal opacity-60">({t('transactions_wizard_optional')})</span>
            </FieldLabel>
            <ContactCombobox
              value={counterpart}
              onChange={(name, contact) => {
                setCounterpart(name)
                setContactSearch(name)
                setContactId(contact?.id)
              }}
              onAddNew={(name) => {
                setContactModalInitialName(name)
                setContactModalOpen(true)
              }}
              contacts={contacts}
              placeholder={t('contact_searchPlaceholder')}
              addLabel={t('transactions_wizard_counterpartAdd')}
            />
          </div>

          {/* Description */}
          <Input
            label={t('transactions_description')}
            value={description}
            onChange={(e) => { setDescription(e.target.value); setDescError('') }}
            error={descError}
          />

          {/* Notes */}
          <Input
            label={`${t('transactions_notes')} (${t('transactions_wizard_optional')})`}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />

          {/* Installment badge (read-only) */}
          {transaction?.is_installment && transaction.installment_number != null && transaction.installment_count != null && (
            <div className="flex items-center gap-2">
              <Repeat className="h-3.5 w-3.5 text-[var(--text-muted)]" />
              <span className="text-xs text-[var(--text-muted)]">
                {t('transactions_detail_installment')} {transaction.installment_number}/{transaction.installment_count}
              </span>
            </div>
          )}

        </div>
      </Modal>

      <ContactModal
        open={contactModalOpen}
        onClose={() => setContactModalOpen(false)}
        initialName={contactModalInitialName}
        onCreated={(contact) => {
          setCounterpart(contact.name)
          setContactSearch(contact.name)
          setContactId(contact.id)
          setContactModalOpen(false)
        }}
      />
    </>
  )
}
