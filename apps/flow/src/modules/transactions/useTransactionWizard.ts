import { useEffect, useRef, useState } from 'react'
import { format } from 'date-fns'
import { useT } from '@/i18n'
import type { Transaction, TransactionNature, TransactionType } from '@/types'
import type { RecurrenceFrequency } from './types'

type Step = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8
type Phase = 'wizard' | 'payment-prompt' | 'payment-form'

export interface WizardPrefill {
  type?: TransactionType
  date?: string
  amountCents?: number
  counterpart?: string
  description?: string
  contactId?: string
  counterpartCnpj?: string
}

export interface UseTransactionWizardState {
  // Phase management
  phase: Phase
  setPhase: (phase: Phase) => void
  createdId: string | null
  setCreatedId: (id: string | null) => void
  skipCountdown: number
  setSkipCountdown: (count: number) => void

  // Wizard state
  step: Step
  setStep: (step: Step) => void
  type: TransactionType | null
  setType: (type: TransactionType | null) => void
  nature: TransactionNature | null
  setNature: (nature: TransactionNature | null) => void
  amountCents: number
  setAmountCents: (cents: number) => void
  date: string
  setDate: (date: string) => void
  categoryId: string | undefined
  setCategoryId: (id: string | undefined) => void
  description: string
  setDescription: (desc: string) => void
  notes: string
  setNotes: (notes: string) => void
  counterpart: string
  setCounterpart: (counterpart: string) => void
  contactId: string | undefined
  setContactId: (id: string | undefined) => void
  isInstallment: boolean
  setIsInstallment: (isInstallment: boolean) => void
  installmentCount: number
  setInstallmentCount: (count: number) => void
  createFutureInstallments: boolean
  setCreateFutureInstallments: (create: boolean) => void
  installmentOverrides: Record<number, { date: string; amountStr: string }>
  setInstallmentOverrides: (overrides: Record<number, { date: string; amountStr: string }>) => void
  isRecurring: boolean
  setIsRecurring: (v: boolean) => void
  recurrenceFrequency: RecurrenceFrequency
  setRecurrenceFrequency: (v: RecurrenceFrequency) => void
  recurrenceCount: number
  setRecurrenceCount: (v: number) => void

  // Validation
  amountError: string
  setAmountError: (error: string) => void
  descError: string
  setDescError: (error: string) => void

  // Contact management
  contactSearch: string
  setContactSearch: (search: string) => void
  contactModalOpen: boolean
  setContactModalOpen: (open: boolean) => void
  contactModalInitialName: string
  setContactModalInitialName: (name: string) => void

  // Payment phase
  paidAt: string
  setPaidAt: (date: string) => void
  paymentMethod: 'cash' | 'bank' | null
  setPaymentMethod: (method: 'cash' | 'bank' | null) => void
  bankId: string | undefined
  setBankId: (id: string | undefined) => void
  methodError: string
  setMethodError: (error: string) => void

  // Utilities
  amountRef: React.RefObject<HTMLInputElement>
  formatCents: (cents: number) => string
  goTo: (step: Step) => void
  goBack: () => void
  selectType: (type: TransactionType) => void
  selectNature: (nature: TransactionNature) => void
  reset: () => void
}

// ── Grouped state types ────────────────────────────────────────

type WizardForm = {
  type: TransactionType | null
  nature: TransactionNature | null
  amountCents: number
  date: string
  categoryId: string | undefined
  description: string
  notes: string
  counterpart: string
  contactId: string | undefined
  isInstallment: boolean
  installmentCount: number
  createFutureInstallments: boolean
  installmentOverrides: Record<number, { date: string; amountStr: string }>
  isRecurring: boolean
  recurrenceFrequency: RecurrenceFrequency
  recurrenceCount: number
}

type PhaseState = {
  phase: Phase
  step: Step
  createdId: string | null
  skipCountdown: number
}

type PaymentState = {
  paidAt: string
  paymentMethod: 'cash' | 'bank' | null
  bankId: string | undefined
  methodError: string
}

type ContactState = {
  contactSearch: string
  contactModalOpen: boolean
  contactModalInitialName: string
}

// ── Initial state factories ────────────────────────────────────

function initForm(editing: Transaction | null, prefill?: WizardPrefill): WizardForm {
  if (editing) {
    return {
      type: editing.type,
      nature: editing.nature ?? (editing.type === 'income' ? 'sale_service' : 'operational_expense'),
      amountCents: Math.round(editing.amount * 100),
      date: editing.date,
      categoryId: editing.category_id ?? undefined,
      description: editing.description ?? '',
      notes: editing.notes ?? '',
      counterpart: editing.counterpart ?? '',
      contactId: editing.contact_id ?? undefined,
      isInstallment: editing.is_installment,
      installmentCount: editing.installment_count ?? 2,
      createFutureInstallments: false,
      installmentOverrides: {},
      isRecurring: false,
      recurrenceFrequency: 'monthly',
      recurrenceCount: 12,
    }
  }
  if (prefill) {
    return {
      type: prefill.type ?? null,
      nature: prefill.type === 'income' ? 'sale_service' : prefill.type === 'expense' ? 'operational_expense' : null,
      amountCents: prefill.amountCents ?? 0,
      date: prefill.date ?? format(new Date(), 'yyyy-MM-dd'),
      categoryId: undefined,
      description: prefill.description ?? '',
      notes: '',
      counterpart: prefill.counterpart ?? '',
      contactId: prefill.contactId,
      isInstallment: false,
      installmentCount: 2,
      createFutureInstallments: true,
      installmentOverrides: {},
      isRecurring: false,
      recurrenceFrequency: 'monthly',
      recurrenceCount: 12,
    }
  }
  return {
    type: null,
    nature: null,
    amountCents: 0,
    date: format(new Date(), 'yyyy-MM-dd'),
    categoryId: undefined,
    description: '',
    notes: '',
    counterpart: '',
    contactId: undefined,
    isInstallment: false,
    installmentCount: 2,
    createFutureInstallments: true,
    installmentOverrides: {},
    isRecurring: false,
    recurrenceFrequency: 'monthly',
    recurrenceCount: 12,
  }
}

const initPayment = (): PaymentState => ({ paidAt: '', paymentMethod: null, bankId: undefined, methodError: '' })
const initContact = (): ContactState => ({ contactSearch: '', contactModalOpen: false, contactModalInitialName: '' })

// ── Hook ───────────────────────────────────────────────────────

export function useTransactionWizardState(
  open: boolean,
  editing: Transaction | null,
  _language: 'pt' | 'en',
  prefill?: WizardPrefill,
  initialStep?: Step
): UseTransactionWizardState {
  const t = useT()

  const [form, setForm] = useState<WizardForm>(() => initForm(editing, prefill))
  const [phaseState, setPhaseState] = useState<PhaseState>({ phase: 'wizard', step: initialStep ?? 1, createdId: null, skipCountdown: 0 })
  const [payment, setPayment] = useState<PaymentState>(initPayment)
  const [contact, setContact] = useState<ContactState>(initContact)
  const [amountError, setAmountError] = useState('')
  const [descError, setDescError] = useState('')

  const amountRef = useRef<HTMLInputElement>(null)

  // Individual setters — thin wrappers that maintain the external interface
  const setType = (v: TransactionType | null) => setForm((f) => ({ ...f, type: v }))
  const setNature = (v: TransactionNature | null) => setForm((f) => ({ ...f, nature: v }))
  const setAmountCents = (v: number) => setForm((f) => ({ ...f, amountCents: v }))
  const setDate = (v: string) => setForm((f) => ({ ...f, date: v }))
  const setCategoryId = (v: string | undefined) => setForm((f) => ({ ...f, categoryId: v }))
  const setDescription = (v: string) => setForm((f) => ({ ...f, description: v }))
  const setNotes = (v: string) => setForm((f) => ({ ...f, notes: v }))
  const setCounterpart = (v: string) => setForm((f) => ({ ...f, counterpart: v }))
  const setContactId = (v: string | undefined) => setForm((f) => ({ ...f, contactId: v }))
  const setIsInstallment = (v: boolean) => setForm((f) => ({ ...f, isInstallment: v }))
  const setInstallmentCount = (v: number) => setForm((f) => ({ ...f, installmentCount: v }))
  const setCreateFutureInstallments = (v: boolean) => setForm((f) => ({ ...f, createFutureInstallments: v }))
  const setInstallmentOverrides = (v: Record<number, { date: string; amountStr: string }>) => setForm((f) => ({ ...f, installmentOverrides: v }))
  const setIsRecurring = (v: boolean) => setForm((f) => ({ ...f, isRecurring: v }))
  const setRecurrenceFrequency = (v: RecurrenceFrequency) => setForm((f) => ({ ...f, recurrenceFrequency: v }))
  const setRecurrenceCount = (v: number) => setForm((f) => ({ ...f, recurrenceCount: v }))

  const setPhase = (v: Phase) => setPhaseState((p) => ({ ...p, phase: v }))
  const setStep = (v: Step) => setPhaseState((p) => ({ ...p, step: v }))
  const setCreatedId = (v: string | null) => setPhaseState((p) => ({ ...p, createdId: v }))
  const setSkipCountdown = (v: number) => setPhaseState((p) => ({ ...p, skipCountdown: v }))

  const setPaidAt = (v: string) => setPayment((p) => ({ ...p, paidAt: v }))
  const setPaymentMethod = (v: 'cash' | 'bank' | null) => setPayment((p) => ({ ...p, paymentMethod: v }))
  const setBankId = (v: string | undefined) => setPayment((p) => ({ ...p, bankId: v }))
  const setMethodError = (v: string) => setPayment((p) => ({ ...p, methodError: v }))

  const setContactSearch = (v: string) => setContact((c) => ({ ...c, contactSearch: v }))
  const setContactModalOpen = (v: boolean) => setContact((c) => ({ ...c, contactModalOpen: v }))
  const setContactModalInitialName = (v: string) => setContact((c) => ({ ...c, contactModalInitialName: v }))

  const formatCents = (cents: number) => {
    const padded = String(cents).padStart(3, '0')
    return padded.slice(0, -2) + ',' + padded.slice(-2)
  }

  const reset = () => {
    setForm(initForm(editing, prefill))
    setPhaseState({ phase: 'wizard', step: editing ? 1 : (initialStep ?? 1), createdId: null, skipCountdown: 0 })
    setPayment(initPayment())
    setContact(initContact())
    setAmountError('')
    setDescError('')
  }

  // Reset state when modal opens/closes
  useEffect(() => {
    if (open) reset()
  }, [open])

  // Reset overrides when base values change
  const { installmentCount, amountCents, date } = form
  useEffect(() => {
    setForm((f) => ({ ...f, installmentOverrides: {} }))
  }, [installmentCount, amountCents, date])

  // Auto-focus amount input
  const { step } = phaseState
  useEffect(() => {
    if (step === 4) setTimeout(() => amountRef.current?.focus(), 50)
  }, [step])

  // Auto-generate description
  const { type, counterpart, description } = form
  useEffect(() => {
    if (step === 7 && !description.trim() && type) {
      const name = counterpart.trim()
      setForm((f) => ({
        ...f,
        description: name
          ? type === 'income'
            ? `${t('transactions_wizard_descPrefixIncomeWith')} ${name}`
            : `${t('transactions_wizard_descPrefixExpenseWith')} ${name}`
          : type === 'income'
            ? t('transactions_wizard_descPrefixIncome')
            : t('transactions_wizard_descPrefixExpense'),
      }))
    }
  }, [step, type, counterpart, description, t])

  // Set default payment date
  const { phase } = phaseState
  const { paidAt } = payment
  useEffect(() => {
    if (phase === 'payment-form' && !paidAt) setPaidAt(format(new Date(), 'yyyy-MM-dd'))
  }, [phase, paidAt])

  // Payment prompt countdown
  const SKIP_DURATION = 5
  useEffect(() => {
    if (phase !== 'payment-prompt') { setSkipCountdown(0); return }
    setSkipCountdown(SKIP_DURATION)
    const id = setInterval(() => {
      setPhaseState((p) => {
        if (p.skipCountdown <= 1) { clearInterval(id); return { ...p, skipCountdown: 0 } }
        return { ...p, skipCountdown: p.skipCountdown - 1 }
      })
    }, 1000)
    return () => clearInterval(id)
  }, [phase])

  const goTo = (s: Step) => setPhaseState((p) => ({ ...p, step: s }))
  const goBack = () => setPhaseState((p) => ({ ...p, step: Math.max(p.step - 1, 1) as Step }))

  const selectType = (v: TransactionType) => {
    setForm((f) => ({ ...f, type: v, nature: v === 'income' ? 'sale_service' : 'operational_expense' }))
    goTo(2)
  }

  const selectNature = (v: TransactionNature) => setNature(v)

  return {
    // Phase management
    phase: phaseState.phase,
    setPhase,
    createdId: phaseState.createdId,
    setCreatedId,
    skipCountdown: phaseState.skipCountdown,
    setSkipCountdown,

    // Wizard state
    step: phaseState.step,
    setStep,
    type: form.type,
    setType,
    nature: form.nature,
    setNature,
    amountCents: form.amountCents,
    setAmountCents,
    date: form.date,
    setDate,
    categoryId: form.categoryId,
    setCategoryId,
    description: form.description,
    setDescription,
    notes: form.notes,
    setNotes,
    counterpart: form.counterpart,
    setCounterpart,
    contactId: form.contactId,
    setContactId,
    isInstallment: form.isInstallment,
    setIsInstallment,
    installmentCount: form.installmentCount,
    setInstallmentCount,
    createFutureInstallments: form.createFutureInstallments,
    setCreateFutureInstallments,
    installmentOverrides: form.installmentOverrides,
    setInstallmentOverrides,
    isRecurring: form.isRecurring,
    setIsRecurring,
    recurrenceFrequency: form.recurrenceFrequency,
    setRecurrenceFrequency,
    recurrenceCount: form.recurrenceCount,
    setRecurrenceCount,

    // Validation
    amountError,
    setAmountError,
    descError,
    setDescError,

    // Contact management
    contactSearch: contact.contactSearch,
    setContactSearch,
    contactModalOpen: contact.contactModalOpen,
    setContactModalOpen,
    contactModalInitialName: contact.contactModalInitialName,
    setContactModalInitialName,

    // Payment phase
    paidAt: payment.paidAt,
    setPaidAt,
    paymentMethod: payment.paymentMethod,
    setPaymentMethod,
    bankId: payment.bankId,
    setBankId,
    methodError: payment.methodError,
    setMethodError,

    // Utilities
    amountRef,
    formatCents,
    goTo,
    goBack,
    selectType,
    selectNature,
    reset,
  }
}
