import { useEffect, useRef, useState } from 'react'
import { format } from 'date-fns'
import { useT } from '@/i18n'
import type { Transaction, TransactionType } from '@/types'

type Step = 1 | 2 | 3 | 4 | 5 | 6 | 7
type Phase = 'wizard' | 'payment-prompt' | 'payment-form'

interface UseTransactionWizardState {
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
  reset: () => void
}

export function useTransactionWizardState(
  open: boolean,
  editing: Transaction | null,
  _language: 'pt' | 'en'
): UseTransactionWizardState {
  const t = useT()

  // Phase management
  const [phase, setPhase] = useState<Phase>('wizard')
  const [createdId, setCreatedId] = useState<string | null>(null)
  const [skipCountdown, setSkipCountdown] = useState(0)

  // Wizard state
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
  const [installmentOverrides, setInstallmentOverrides] = useState<Record<number, { date: string; amountStr: string }>>({})

  // Validation
  const [amountError, setAmountError] = useState('')
  const [descError, setDescError] = useState('')

  // Contact management
  const [contactSearch, setContactSearch] = useState('')
  const [contactModalOpen, setContactModalOpen] = useState(false)
  const [contactModalInitialName, setContactModalInitialName] = useState('')

  // Payment phase
  const [paidAt, setPaidAt] = useState('')
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'bank' | null>(null)
  const [bankId, setBankId] = useState<string | undefined>()
  const [methodError, setMethodError] = useState('')

  const amountRef = useRef<HTMLInputElement>(null)

  const formatCents = (cents: number) => {
    const padded = String(cents).padStart(3, '0')
    return padded.slice(0, -2) + ',' + padded.slice(-2)
  }

  const reset = () => {
    setPhase('wizard')
    setCreatedId(null)
    setAmountError('')
    setDescError('')
    setPaidAt('')
    setPaymentMethod(null)
    setBankId(undefined)
    setMethodError('')
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
      setCreateFutureInstallments(true)
    }
    setInstallmentOverrides({})
  }

  // Reset state when modal opens/closes
  useEffect(() => {
    if (open) reset()
  }, [open])

  // Reset overrides when base values change
  useEffect(() => { setInstallmentOverrides({}) }, [installmentCount, amountCents, date])

  // Auto-focus amount input
  useEffect(() => {
    if (step === 3) setTimeout(() => amountRef.current?.focus(), 50)
  }, [step])

  // Auto-generate description
  useEffect(() => {
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
  }, [step, type, counterpart, description, t])

  // Set default payment date
  useEffect(() => {
    if (phase === 'payment-form' && !paidAt) setPaidAt(format(new Date(), 'yyyy-MM-dd'))
  }, [phase, paidAt])

  // Payment prompt countdown
  const SKIP_DURATION = 5
  useEffect(() => {
    if (phase !== 'payment-prompt') { setSkipCountdown(0); return }
    setSkipCountdown(SKIP_DURATION)
    const id = setInterval(() => {
      setSkipCountdown((v) => {
        if (v <= 1) { clearInterval(id); return 0 }
        return v - 1
      })
    }, 1000)
    return () => clearInterval(id)
  }, [phase])

  const goTo = (s: Step) => setStep(s)
  const goBack = () => setStep((s) => Math.max(s - 1, 1) as Step)

  const selectType = (v: TransactionType) => {
    setType(v)
    goTo(2)
  }

  return {
    // Phase management
    phase,
    setPhase,
    createdId,
    setCreatedId,
    skipCountdown,
    setSkipCountdown,

    // Wizard state
    step,
    setStep,
    type,
    setType,
    amountCents,
    setAmountCents,
    date,
    setDate,
    categoryId,
    setCategoryId,
    description,
    setDescription,
    notes,
    setNotes,
    counterpart,
    setCounterpart,
    contactId,
    setContactId,
    isInstallment,
    setIsInstallment,
    installmentCount,
    setInstallmentCount,
    createFutureInstallments,
    setCreateFutureInstallments,
    installmentOverrides,
    setInstallmentOverrides,

    // Validation
    amountError,
    setAmountError,
    descError,
    setDescError,

    // Contact management
    contactSearch,
    setContactSearch,
    contactModalOpen,
    setContactModalOpen,
    contactModalInitialName,
    setContactModalInitialName,

    // Payment phase
    paidAt,
    setPaidAt,
    paymentMethod,
    setPaymentMethod,
    bankId,
    setBankId,
    methodError,
    setMethodError,

    // Utilities
    amountRef,
    formatCents,
    goTo,
    goBack,
    selectType,
    reset,
  }
}