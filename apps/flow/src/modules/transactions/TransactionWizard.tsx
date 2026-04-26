import { useEffect, useRef, useState } from 'react'
import { format, addMonths, parseISO, parse, isValid } from 'date-fns'
import { ptBR, enUS } from 'date-fns/locale'
import { TrendingUp, TrendingDown, ChevronLeft, CreditCard, Repeat, CheckCircle, UserPlus } from 'lucide-react'
import { Button, Checkbox, DatePicker, DayCalendar, Input, Modal, Select } from '@syncero/ui'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useT } from '@/i18n'
import { useCreateTransaction, useUpdateTransaction, useDeleteTransaction } from './mutations'
import { useCategories, useBanks, useContacts } from './queries'
import { createContact } from '@/lib/backend'
import { useAuthStore } from '@/store/auth'
import type { Transaction, TransactionType, Contact } from '@/types'

interface Props {
  open: boolean
  onClose: () => void
  editing: Transaction | null
  language: 'pt' | 'en'
}

type Step = 1 | 2 | 3 | 4 | 5 | 6 | 7
type Phase = 'wizard' | 'payment-prompt' | 'payment-form'

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

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && name.trim() && !save.isPending) save.mutate()
  }

  return (
    <Modal open={open} onClose={onClose} title={t('contact_newTitle')} size="sm">
      <div className="flex flex-col gap-4">
        <Input
          label={t('contact_name')}
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={handleKeyDown}
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
        <Button variant="ghost" size="sm" onClick={onClose}>
          {t('contact_cancel')}
        </Button>
        <Button
          onClick={() => save.mutate()}
          loading={save.isPending}
          disabled={!name.trim()}
        >
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
  onConfirm,
  contacts,
  placeholder,
  addLabel,
}: {
  value: string
  onChange: (name: string, contact?: Contact) => void
  onAddNew: (query: string) => void
  onConfirm?: () => void
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
      } else if (value.trim()) {
        onConfirm?.()
      }
    }
  }

  return (
    <div ref={containerRef} className="relative">
      <input
        type="text"
        value={query}
        placeholder={placeholder}
        autoFocus
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
        </div>
      )}
    </div>
  )
}

// ── Wizard ───────────────────────────────────────────────────

export function TransactionWizard({ open, onClose, editing, language }: Props) {
  const t = useT()
  const create = useCreateTransaction()
  const update = useUpdateTransaction()
  const deleteT = useDeleteTransaction()
  const user = useAuthStore((s) => s.user)
  const { data: categories = [] } = useCategories()
  const { data: banks = [] } = useBanks()

  const [phase, setPhase] = useState<Phase>('wizard')
  const [createdId, setCreatedId] = useState<string | null>(null)

  const [step, setStep] = useState<Step>(1)
  const [type, setType] = useState<TransactionType | null>(null)
  const [amountCents, setAmountCents] = useState(0)
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [categoryId, setCategoryId] = useState<string | undefined>()
  const [description, setDescription] = useState('')
  const [notes, setNotes] = useState('')
  const [counterpart, setCounterpart] = useState('')
  const [contactId, setContactId] = useState<string | undefined>()
  const [isInstallment, setIsInstallment] = useState(false)
  const [installmentCount, setInstallmentCount] = useState(2)
  const [createFutureInstallments, setCreateFutureInstallments] = useState(false)
  const [amountError, setAmountError] = useState('')
  const [descError, setDescError] = useState('')

  // Contact search & modal
  const [contactSearch, setContactSearch] = useState('')
  const [contactModalOpen, setContactModalOpen] = useState(false)
  const [contactModalInitialName, setContactModalInitialName] = useState('')
  const { data: contacts = [] } = useContacts(contactSearch)

  // Payment phase state
  const [paidAt, setPaidAt] = useState('')
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'bank' | null>(null)
  const [bankId, setBankId] = useState<string | undefined>()
  const [methodError, setMethodError] = useState('')
  const [bankError, setBankError] = useState('')

  const amountRef = useRef<HTMLInputElement>(null)
  const isCreating = !editing
  const isPending = create.isPending || update.isPending

  const formatCents = (cents: number) => {
    const padded = String(cents).padStart(3, '0')
    return padded.slice(0, -2) + ',' + padded.slice(-2)
  }

  useEffect(() => {
    if (!open) return
    setPhase('wizard')
    setCreatedId(null)
    setAmountError('')
    setDescError('')
    setPaidAt('')
    setPaymentMethod(null)
    setBankId(undefined)
    setMethodError('')
    setBankError('')
    setContactSearch('')
    if (editing) {
      setStep(1)
      setType(editing.type)
      setAmountCents(Math.round(editing.amount * 100))
      setDate(editing.date)
      setCategoryId(editing.category_id ?? undefined)
      setDescription(editing.description ?? '')
      setNotes(editing.notes ?? '')
      setCounterpart(editing.counterpart ?? '')
      setContactId(editing.contact_id ?? undefined)
      setIsInstallment(editing.is_installment)
      setInstallmentCount(editing.installment_count ?? 2)
      setCreateFutureInstallments(false)
    } else {
      setStep(1)
      setType(null)
      setAmountCents(0)
      setDate(format(new Date(), 'yyyy-MM-dd'))
      setCategoryId(undefined)
      setDescription('')
      setNotes('')
      setCounterpart('')
      setContactId(undefined)
      setIsInstallment(false)
      setInstallmentCount(2)
      setCreateFutureInstallments(false)
    }
  }, [open])

  useEffect(() => {
    if (step === 3) setTimeout(() => amountRef.current?.focus(), 50)

    if (step === 7 && !description.trim() && type) {
      const name = counterpart.trim()
      if (name) {
        setDescription(
          type === 'income'
            ? `${t('transactions_wizard_descPrefixIncomeWith')} ${name}`
            : `${t('transactions_wizard_descPrefixExpenseWith')} ${name}`
        )
      } else {
        setDescription(
          type === 'income'
            ? t('transactions_wizard_descPrefixIncome')
            : t('transactions_wizard_descPrefixExpense')
        )
      }
    }
  }, [step])

  useEffect(() => {
    if (phase === 'payment-form' && !paidAt) setPaidAt(format(new Date(), 'yyyy-MM-dd'))
  }, [phase])

  const goTo = (s: Step) => setStep(s)
  const goBack = () => setStep((s) => Math.max(s - 1, 1) as Step)

  const selectType = (v: TransactionType) => {
    if (v !== type) setCategoryId(undefined)
    setType(v)
    goTo(2)
  }

  const selectInstallment = (v: boolean) => setIsInstallment(v)

  const selectCategory = (id: string | undefined) => {
    setCategoryId(id)
    if (isCreating) goTo(6)
  }

  const validateAmount = () => {
    if (amountCents <= 0) { setAmountError(t('transactions_errorAmount')); return false }
    setAmountError('')
    return true
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
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (validateAmount()) goTo(4)
    } else if (!['Tab', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
      e.preventDefault()
    }
  }

  // Keyboard handler ref — always has fresh closures, registered once on open
  const wizardKeyRef = useRef<(e: KeyboardEvent) => void>()

  const handleNext = () => {
    if (step === 1 && !type) return
    if (step === 3 && !validateAmount()) return
    goTo((step + 1) as Step)
  }

  const handleSave = async () => {
    if (!type) return
    setDescError('')
    if (!description.trim()) { setDescError(t('transactions_errorDescription')); return }
    if (amountCents <= 0) { setAmountError(t('transactions_errorAmount')); goTo(3); return }

    const basePayload = {
      type,
      amount: amountCents / 100,
      date,
      category_id: categoryId || undefined,
      description: description.trim(),
      notes: notes.trim() || undefined,
      counterpart: counterpart.trim() || undefined,
      contact_id: contactId || undefined,
      is_paid: false,
      is_installment: isInstallment,
      installment_count: isInstallment ? installmentCount : undefined,
    }

    if (editing) {
      await update.mutateAsync({ id: editing.id, data: basePayload })
      onClose()
      return
    }

    if (isInstallment && createFutureInstallments && installmentCount >= 2) {
      const groupId = crypto.randomUUID()
      let firstId: string | null = null
      for (let i = 0; i < installmentCount; i++) {
        const result = await create.mutateAsync({
          ...basePayload,
          date: format(addMonths(parseISO(date), i), 'yyyy-MM-dd'),
          description: `${description.trim()} (${i + 1}/${installmentCount})`,
          installment_number: i + 1,
          installment_group_id: groupId,
        })
        if (i === 0) firstId = result?.id ?? null
      }
      setCreatedId(firstId)
    } else {
      const result = await create.mutateAsync({
        ...basePayload,
        installment_number: isInstallment ? 1 : undefined,
        installment_group_id: isInstallment ? crypto.randomUUID() : undefined,
      })
      setCreatedId(result?.id ?? null)
    }

    setPhase('payment-prompt')
  }

  const validatePayment = () => {
    let ok = true
    if (!paymentMethod) { setMethodError(t('transactions_payment_methodRequired')); ok = false }
    else setMethodError('')
    if (paymentMethod === 'bank' && !bankId) { setBankError(t('transactions_payment_bankRequired')); ok = false }
    else setBankError('')
    return ok
  }

  const handleRegisterPayment = async () => {
    if (!createdId || !paidAt || !validatePayment()) return
    await update.mutateAsync({
      id: createdId,
      data: {
        is_paid: true,
        paid_at: paidAt,
        payment_method: paymentMethod ?? undefined,
        bank_id: paymentMethod === 'bank' ? bankId ?? undefined : undefined,
        payment_registered_at: new Date().toISOString(),
        payment_registered_by: user?.id ?? undefined,
      },
    })
    onClose()
  }

  const handleDelete = async () => {
    await deleteT.mutateAsync(editing!.id)
    onClose()
  }

  // ── Global keyboard handler ──────────────────────────────────

  // Always update ref with fresh closures — registered once on open
  wizardKeyRef.current = (e: KeyboardEvent) => {
    const target = e.target as HTMLElement

    // Payment prompt: Enter confirms
    if (phase === 'payment-prompt') {
      if (e.key === 'Enter') { e.preventDefault(); setPhase('payment-form') }
      return
    }

    // Payment form: Enter saves
    if (phase === 'payment-form') {
      if (e.key === 'Enter' && !update.isPending) { e.preventDefault(); handleRegisterPayment() }
      return
    }

    if (phase !== 'wizard') return
    if (target.tagName === 'TEXTAREA') return

    // Steps 3 and 6 handle their own Enter/Arrow keys
    if (step === 3 || step === 6) return

    // Card steps: arrow keys cycle options
    if (step === 1) {
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        e.preventDefault()
        setType((prev) => prev === 'income' ? 'expense' : 'income')
        setCategoryId(undefined)
      }
      if (e.key === 'Enter' && type) { e.preventDefault(); goTo(2) }
      return
    }

    if (step === 4) {
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        e.preventDefault()
        setIsInstallment((prev) => !prev)
      }
      if (e.key === 'Enter') { e.preventDefault(); handleNext() }
      return
    }

    if (step === 5) {
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        e.preventDefault()
        const filtered = categories.filter((c) => c.type === type)
        const options: (string | undefined)[] = [...filtered.map((c) => c.id), undefined]
        const currentIdx = categoryId === undefined ? options.length - 1 : options.indexOf(categoryId)
        const nextIdx = e.key === 'ArrowRight'
          ? (currentIdx + 1) % options.length
          : (currentIdx - 1 + options.length) % options.length
        setCategoryId(options[nextIdx])
      }
      if (e.key === 'Enter') { e.preventDefault(); isCreating ? goTo(6) : handleNext() }
      return
    }

    if (e.key !== 'Enter') return

    if (step === 7) {
      if (!isPending && description.trim()) { e.preventDefault(); handleSave() }
      return
    }

    if (showNext && !nextDisabled) { e.preventDefault(); handleNext() }
  }

  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => wizardKeyRef.current?.(e)
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [open])

  // ── Installment preview ──────────────────────────────────────

  const installmentPreview = (() => {
    if (!isInstallment || installmentCount < 2 || amountCents <= 0 || !date) return null
    const perInstallment = Math.floor(amountCents / installmentCount)
    const remainder = amountCents - perInstallment * (installmentCount - 1)
    return Array.from({ length: installmentCount }, (_, i) => ({
      number: i + 1,
      date: format(addMonths(parseISO(date), i), 'dd/MM/yyyy'),
      cents: i === installmentCount - 1 ? remainder : perInstallment,
    }))
  })()

  // ── Step content ────────────────────────────────────────────

  const stepContent: Record<Step, React.ReactNode> = {
    1: (
      <div className="flex flex-col gap-3">
        <p className="text-sm text-[var(--text-muted)] text-center mb-1">
          {t('transactions_wizard_typeLabel')}
        </p>
        <div className="grid grid-cols-2 gap-3">
          {([['income', TrendingUp], ['expense', TrendingDown]] as const).map(([v, Icon]) => (
            <button
              key={v}
              type="button"
              onClick={() => selectType(v)}
              className={`flex flex-col items-center gap-3 py-6 rounded-xl border-2 transition-all cursor-pointer ${
                type === v
                  ? v === 'income'
                    ? 'border-[var(--success)] bg-[var(--success)]/10'
                    : 'border-[var(--danger)] bg-[var(--danger)]/10'
                  : 'border-[var(--bg-border)] hover:bg-[var(--bg-elevated)]'
              }`}
            >
              <Icon className={`h-8 w-8 ${
                type === v
                  ? v === 'income' ? 'text-[var(--success)]' : 'text-[var(--danger)]'
                  : 'text-[var(--text-muted)]'
              }`} />
              <span className={`text-sm font-medium ${
                type === v
                  ? v === 'income' ? 'text-[var(--success)]' : 'text-[var(--danger)]'
                  : 'text-[var(--text-secondary)]'
              }`}>
                {v === 'income' ? t('transactions_income_badge') : t('transactions_expense_badge')}
              </span>
            </button>
          ))}
        </div>
      </div>
    ),

    2: (() => {
      const parsed = date ? parse(date, 'yyyy-MM-dd', new Date()) : undefined
      const selected = parsed && isValid(parsed) ? parsed : undefined
      const locale = language === 'en' ? enUS : ptBR
      return (
        <div className="flex flex-col items-center gap-5">
          <p className="text-sm text-[var(--text-muted)] text-center">
            {type === 'income'
              ? t('transactions_wizard_dateIncomeLabel')
              : t('transactions_wizard_dateExpenseLabel')}
          </p>
          <DayCalendar
            selected={selected}
            onSelect={(d) => setDate(format(d, 'yyyy-MM-dd'))}
            locale={locale}
          />
        </div>
      )
    })(),

    3: (
      <div className="flex flex-col gap-5">
        <p className="text-sm text-[var(--text-muted)] text-center">
          {t('transactions_wizard_amountLabel')}
        </p>
        <div className="flex flex-col items-center gap-1">
          <div className="flex items-baseline gap-2">
            <span className={`text-xl font-medium ${
              type === 'income' ? 'text-[var(--success)]' : 'text-[var(--danger)]'
            }`}>R$</span>
            <input
              ref={amountRef}
              type="text"
              inputMode="numeric"
              value={formatCents(amountCents)}
              onChange={() => {}}
              onKeyDown={handleAmountKey}
              className={`w-56 font-semibold text-center bg-transparent outline-none border-b-2 pb-1 transition-all text-[var(--text-primary)] ${
                amountError ? 'border-[var(--danger)]' : 'border-[var(--bg-border)] focus:border-[var(--accent)]'
              } ${
                formatCents(amountCents).length <= 6 ? 'text-5xl' :
                formatCents(amountCents).length <= 7 ? 'text-4xl' : 'text-3xl'
              }`}
            />
          </div>
          {amountError && <p className="text-xs text-[var(--danger)]">{amountError}</p>}
        </div>
      </div>
    ),

    4: (
      <div className="flex flex-col gap-3">
        <p className="text-sm text-[var(--text-muted)] text-center mb-1">
          {t('transactions_wizard_installmentLabel')}
        </p>
        <div className="grid grid-cols-2 gap-3">
          {([
            [false, CreditCard, t('transactions_wizard_notInstallment')],
            [true, Repeat, t('transactions_wizard_installment')],
          ] as const).map(([v, Icon, label]) => (
            <button
              key={String(v)}
              type="button"
              onClick={() => selectInstallment(v)}
              className={`flex flex-col items-center gap-3 py-6 rounded-xl border-2 transition-all cursor-pointer ${
                isInstallment === v
                  ? 'border-[var(--accent)] bg-[var(--accent)]/10'
                  : 'border-[var(--bg-border)] hover:bg-[var(--bg-elevated)]'
              }`}
            >
              <Icon className={`h-8 w-8 ${
                isInstallment === v ? 'text-[var(--accent)]' : 'text-[var(--text-muted)]'
              }`} />
              <span className={`text-sm font-medium ${
                isInstallment === v ? 'text-[var(--accent)]' : 'text-[var(--text-secondary)]'
              }`}>
                {label}
              </span>
            </button>
          ))}
        </div>

        {isInstallment && (
          <div className="flex flex-col gap-3 mt-2 pl-1">
            <Input
              label={t('transactions_installmentCount')}
              type="number"
              min="2"
              max="120"
              value={String(installmentCount)}
              onChange={(e) => setInstallmentCount(Math.max(2, parseInt(e.target.value) || 2))}
            />
            {isCreating && (
              <Checkbox
                label={t('transactions_createFutureInstallments')}
                checked={createFutureInstallments}
                onChange={(e) => setCreateFutureInstallments(e.target.checked)}
              />
            )}
            {installmentPreview && (
              <div className="flex flex-col gap-1 max-h-36 overflow-y-auto rounded-lg border border-[var(--bg-border)] divide-y divide-[var(--bg-border)]">
                {installmentPreview.map((p) => (
                  <div key={p.number} className="flex items-center justify-between px-3 py-2 text-xs">
                    <span className="text-[var(--text-muted)] tabular-nums">
                      {p.number}/{installmentCount}
                    </span>
                    <span className="text-[var(--text-secondary)]">{p.date}</span>
                    <span className={`font-medium tabular-nums ${
                      type === 'income' ? 'text-[var(--success)]' : 'text-[var(--danger)]'
                    }`}>
                      R$ {formatCents(p.cents)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    ),

    5: (() => {
      const filtered = categories.filter((c) => c.type === type)
      return (
        <div className="flex flex-col gap-3">
          <p className="text-sm text-[var(--text-muted)] text-center">
            {t('transactions_wizard_categoryLabel')}
            <span className="ml-1.5 text-xs opacity-60">
              ({t('transactions_wizard_optional')})
            </span>
          </p>
          <div className="grid grid-cols-2 gap-2 max-h-56 overflow-y-auto pr-0.5">
            {filtered.map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => selectCategory(cat.id)}
                className={`flex items-center gap-2 px-3 py-3.5 rounded-lg border transition-all cursor-pointer text-left ${
                  categoryId === cat.id
                    ? 'border-[var(--accent)] bg-[var(--accent)]/10'
                    : 'border-[var(--bg-border)] hover:bg-[var(--bg-elevated)]'
                }`}
              >
                <div
                  className="h-2.5 w-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: cat.color ?? '#94a3b8' }}
                />
                <span className="text-sm text-[var(--text-primary)] truncate">{cat.name}</span>
              </button>
            ))}
            <button
              type="button"
              onClick={() => selectCategory(undefined)}
              className={`flex items-center gap-2 px-3 py-3.5 rounded-lg border transition-all cursor-pointer text-left ${
                categoryId === undefined
                  ? 'border-[var(--accent)] bg-[var(--accent)]/10'
                  : 'border-[var(--bg-border)] hover:bg-[var(--bg-elevated)]'
              }`}
            >
              <div className="h-2.5 w-2.5 rounded-full shrink-0 bg-[var(--bg-border)]" />
              <span className="text-sm text-[var(--text-muted)]">{t('transactions_noCategory')}</span>
            </button>
          </div>
          {filtered.length === 0 && (
            <p className="text-xs text-[var(--text-muted)] text-center">
              {t('transactions_wizard_noCategoriesHint')}
            </p>
          )}
        </div>
      )
    })(),

    6: (
      <div className="flex flex-col gap-5">
        <p className="text-sm text-[var(--text-muted)] text-center">
          {type === 'income'
            ? t('transactions_wizard_counterpartIncomeLabel')
            : t('transactions_wizard_counterpartExpenseLabel')}
        </p>
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
          onConfirm={handleNext}
          contacts={contacts}
          placeholder={t('contact_searchPlaceholder')}
          addLabel={t('transactions_wizard_counterpartAdd')}
        />
      </div>
    ),

    7: (
      <div className="flex flex-col gap-4">
        <p className="text-sm text-[var(--text-muted)] text-center mb-1">
          {t('transactions_wizard_detailsLabel')}
        </p>
        <Input
          label={t('transactions_description')}
          value={description}
          onChange={(e) => { setDescription(e.target.value); setDescError('') }}
          error={descError}
        />
        <Input
          label={`${t('transactions_notes')} (${t('transactions_wizard_optional')})`}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </div>
    ),
  }

  // ── Payment prompt & form ────────────────────────────────────

  const paymentPrompt = (
    <div className="flex flex-col items-center gap-5 py-4">
      <div className="flex items-center justify-center h-14 w-14 rounded-full bg-[var(--success)]/10">
        <CheckCircle className="h-7 w-7 text-[var(--success)]" />
      </div>
      <div className="text-center">
        <p className="text-base font-medium text-[var(--text-primary)]">
          {t('transactions_payment_promptTitle')}
        </p>
        <p className="text-sm text-[var(--text-muted)] mt-1">
          {t('transactions_payment_promptSubtitle')}
        </p>
      </div>
    </div>
  )

  const paymentForm = (
    <div className="flex flex-col gap-4">
      <DatePicker
        label={t('transactions_paidAt')}
        value={paidAt}
        onChange={setPaidAt}
        language={language}
      />
      <div className="flex flex-col gap-1">
        <Select
          label={t('transactions_paymentMethod')}
          placeholder={t('common_select')}
          value={paymentMethod ?? ''}
          onChange={(v) => {
            setPaymentMethod((v as 'cash' | 'bank') || null)
            setMethodError('')
            if (v !== 'bank') { setBankId(undefined); setBankError('') }
          }}
          options={[
            { value: 'cash', label: t('transactions_paymentCash') },
            { value: 'bank', label: t('transactions_paymentBank') },
          ]}
        />
        {methodError && <p className="text-xs text-[var(--danger)]">{methodError}</p>}
      </div>
      {paymentMethod === 'bank' && (
        <div className="flex flex-col gap-1">
          <Select
            label={t('transactions_bankAccount')}
            placeholder={t('common_select')}
            value={bankId ?? ''}
            onChange={(v) => { setBankId(v || undefined); setBankError('') }}
            options={banks.map((b) => ({ value: b.id, label: b.name }))}
          />
          {bankError && <p className="text-xs text-[var(--danger)]">{bankError}</p>}
        </div>
      )}
    </div>
  )

  // ── Render ──────────────────────────────────────────────────

  const showNext = step < 7 && (
    step === 2 ||
    step === 3 ||
    step === 4 ||
    (step === 5 && categoryId === undefined) ||
    (step === 6 && counterpart.trim().length > 0) ||
    !!editing
  )
  const nextDisabled = step === 1 && !type

  const modalTitle = phase === 'payment-form'
    ? t('transactions_payment_formTitle')
    : editing
    ? t('transactions_editTitle')
    : t('transactions_newTitle')

  const keyboardHint = (() => {
    if (phase === 'payment-prompt') return t('transactions_wizard_keyHintPaymentPrompt')
    if (phase === 'payment-form') return t('transactions_wizard_keyHintPaymentForm')
    if (step === 1 || step === 4 || step === 5) return t('transactions_wizard_keyHintCards')
    if (step === 6) return t('transactions_wizard_keyHintContact')
    if (step === 7) return t('transactions_wizard_keyHintSave')
    return t('transactions_wizard_keyHintEnter')
  })()

  return (
    <>
      <Modal open={open} onClose={onClose} title={modalTitle} size="sm">

        {/* ── Keyboard hint (desktop only) ── */}
        <div className="hidden md:flex justify-center -mt-2 mb-4">
          <span className="text-xs text-[var(--text-muted)] font-mono select-none bg-[var(--bg-elevated)] px-2.5 py-1 rounded-full">
            {keyboardHint}
          </span>
        </div>

        {/* ── Wizard phase ── */}
        {phase === 'wizard' && (
          <>
            <div className="flex justify-center gap-2 mb-6">
              {([1, 2, 3, 4, 5, 6, 7] as const).map((s) => (
                <div
                  key={s}
                  className={`h-1.5 rounded-full transition-all duration-200 ${
                    s === step
                      ? 'w-6 bg-[var(--accent)]'
                      : s < step
                      ? 'w-3 bg-[var(--accent)] opacity-40'
                      : 'w-3 bg-[var(--bg-border)]'
                  }`}
                />
              ))}
            </div>

            <div className="min-h-52">{stepContent[step]}</div>

            <div className="flex items-center justify-between mt-6 pt-4 border-t border-[var(--bg-border)]">
              <div>
                {step === 1 ? (
                  <Button variant="ghost" size="sm" onClick={onClose}>
                    {t('transactions_cancel')}
                  </Button>
                ) : (
                  <Button variant="ghost" size="sm" onClick={goBack}>
                    <ChevronLeft className="h-4 w-4" />
                    {t('transactions_wizard_back')}
                  </Button>
                )}
              </div>
              <div className="flex gap-2">
                {editing && step === 7 && (
                  <Button variant="danger" size="sm" onClick={handleDelete} loading={deleteT.isPending}>
                    {t('transactions_delete')}
                  </Button>
                )}
                {showNext && (
                  <Button onClick={handleNext} disabled={nextDisabled}>
                    {t('transactions_wizard_next')}
                  </Button>
                )}
                {step === 7 && (
                  <Button onClick={handleSave} loading={isPending} disabled={!description.trim()}>
                    {t('transactions_save')}
                  </Button>
                )}
              </div>
            </div>
          </>
        )}

        {/* ── Payment prompt phase ── */}
        {phase === 'payment-prompt' && (
          <>
            <div className="min-h-52">{paymentPrompt}</div>
            <div className="flex items-center justify-between mt-6 pt-4 border-t border-[var(--bg-border)]">
              <Button variant="ghost" size="sm" onClick={onClose}>
                {t('transactions_payment_skip')}
              </Button>
              <Button onClick={() => setPhase('payment-form')}>
                {t('transactions_payment_register')}
              </Button>
            </div>
          </>
        )}

        {/* ── Payment form phase ── */}
        {phase === 'payment-form' && (
          <>
            <div className="min-h-52">{paymentForm}</div>
            <div className="flex items-center justify-between mt-6 pt-4 border-t border-[var(--bg-border)]">
              <Button variant="ghost" size="sm" onClick={() => setPhase('payment-prompt')}>
                <ChevronLeft className="h-4 w-4" />
                {t('transactions_wizard_back')}
              </Button>
              <Button
                onClick={handleRegisterPayment}
                loading={update.isPending}
                disabled={!paidAt || !paymentMethod || (paymentMethod === 'bank' && !bankId)}
              >
                {t('transactions_payment_confirm')}
              </Button>
            </div>
          </>
        )}

      </Modal>

      {/* Quick-add contact — rendered outside wizard modal so both stack */}
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
