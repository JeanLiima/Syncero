import { useEffect, useRef } from 'react'
import { format, addMonths, parseISO, parse, isValid } from 'date-fns'
import { ptBR, enUS } from 'date-fns/locale'
import {
  TrendingUp, TrendingDown, ChevronLeft, CreditCard, Repeat,
  ShoppingCart, Banknote, Users, Receipt, Package, ArrowDownLeft, ArrowUpRight,
} from 'lucide-react'
import { Button, Checkbox, DayCalendar, Input, Modal } from '@syncero/ui'
import { useT, type TranslationKey } from '@/i18n'
import { useCreateTransaction, useUpdateTransaction, useDeleteTransaction } from './mutations'
import { useCategories, useBanks, useContacts } from './queries'
import { useAuthStore } from '@syncero/auth'
import { ContactModal } from './ContactModal'
import { ContactCombobox } from './ContactCombobox'
import { useTransactionWizardState } from './useTransactionWizard'
import { PaymentPromptStep } from './PaymentPromptStep'
import { PaymentFormStep } from './PaymentFormStep'
import { SEGMENTS_WITH_COST } from '@/lib/segments'
import type { Transaction, TransactionNature } from '@/types'

interface Props {
  open: boolean
  onClose: () => void
  editing: Transaction | null
  language: 'pt' | 'en'
}

type Step = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8

// ── Nature option config ────────────────────────────────────────

type NatureOption = {
  value: TransactionNature
  labelKey: TranslationKey
  descKey: TranslationKey
  icon: React.ElementType
  common?: true
}

const INCOME_NATURES: NatureOption[] = [
  { value: 'sale_service',         labelKey: 'transactions_nature_sale_service',         descKey: 'transactions_nature_sale_service_desc',         icon: ShoppingCart, common: true },
  { value: 'loan_received',        labelKey: 'transactions_nature_loan_received',        descKey: 'transactions_nature_loan_received_desc',        icon: Banknote      },
  { value: 'capital_contribution', labelKey: 'transactions_nature_capital_contribution', descKey: 'transactions_nature_capital_contribution_desc', icon: Users         },
]

const BASE_EXPENSE_NATURES: NatureOption[] = [
  { value: 'operational_expense', labelKey: 'transactions_nature_operational_expense', descKey: 'transactions_nature_operational_expense_desc', icon: Receipt,      common: true },
  { value: 'product_cost',        labelKey: 'transactions_nature_product_cost',        descKey: 'transactions_nature_product_cost_desc',        icon: Package       },
  { value: 'asset_purchase',      labelKey: 'transactions_nature_asset_purchase',      descKey: 'transactions_nature_asset_purchase_desc',      icon: Package        },
  { value: 'debt_payment',        labelKey: 'transactions_nature_debt_payment',        descKey: 'transactions_nature_debt_payment_desc',        icon: ArrowDownLeft  },
  { value: 'owner_withdrawal',    labelKey: 'transactions_nature_owner_withdrawal',    descKey: 'transactions_nature_owner_withdrawal_desc',    icon: ArrowUpRight   },
]

// ── Wizard ───────────────────────────────────────────────────

export function TransactionWizard({ open, onClose, editing, language }: Props) {
  const t = useT()
  const activeCompany  = useAuthStore(s => s.activeCompany)
  const hasCostSegment = activeCompany?.segment ? SEGMENTS_WITH_COST.has(activeCompany.segment) : false
  const EXPENSE_NATURES = hasCostSegment
    ? BASE_EXPENSE_NATURES
    : BASE_EXPENSE_NATURES.filter(n => n.value !== 'product_cost')
  const create = useCreateTransaction()
  const update = useUpdateTransaction()
  const deleteT = useDeleteTransaction()
  const user = useAuthStore((s) => s.user)
  const { data: categories = [] } = useCategories()
  const { data: banks = [] } = useBanks()

  const state = useTransactionWizardState(open, editing, language)
  const { data: contacts = [] } = useContacts(state.contactSearch)

  const isCreating = !editing
  const isPending = create.isPending || update.isPending

  // Close modal when countdown reaches zero
  useEffect(() => {
    if (state.phase === 'payment-prompt' && state.skipCountdown === 0) onClose()
  }, [state.skipCountdown]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Handlers ────────────────────────────────────────────────

  const handleNext = () => {
    if (state.step === 1 && !state.type) return
    if (state.step === 2 && !state.nature) return
    if (state.step === 4 && !validateAmount()) return
    state.goTo((state.step + 1) as Step)
  }

  const validateAmount = () => {
    if (state.amountCents <= 0) { state.setAmountError(t('transactions_errorAmount')); return false }
    state.setAmountError('')
    return true
  }

  const handleAmountKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key >= '0' && e.key <= '9') {
      e.preventDefault()
      const digit = parseInt(e.key)
      const newCents = state.amountCents * 10 + digit
      state.setAmountCents(newCents > 9999999 ? state.amountCents : newCents)
      state.setAmountError('')
    } else if (e.key === 'Backspace') {
      e.preventDefault()
      state.setAmountCents(Math.floor(state.amountCents / 10))
    } else if (e.key === 'Enter') {
      e.preventDefault()
    } else if (!['Tab', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
      e.preventDefault()
    }
  }

  const selectCategory = (id: string | undefined) => {
    state.setCategoryId(id)
    if (isCreating) state.goTo(7)
  }

  const handleSave = async () => {
    if (!state.type) return
    state.setDescError('')
    if (!state.description.trim()) { state.setDescError(t('transactions_errorDescription')); return }
    if (state.amountCents <= 0) { state.setAmountError(t('transactions_errorAmount')); state.goTo(4); return }
    if (!state.counterpart.trim()) { state.goTo(7); return }

    const basePayload = {
      type: state.type,
      nature: state.nature ?? undefined,
      amount: state.amountCents / 100,
      date: state.date,
      category_id: state.categoryId || undefined,
      description: state.description.trim(),
      notes: state.notes.trim() || undefined,
      counterpart: state.counterpart.trim() || undefined,
      contact_id: state.contactId || undefined,
      is_paid: false,
      is_installment: state.isInstallment,
      installment_count: state.isInstallment ? state.installmentCount : undefined,
    }

    if (editing) {
      await update.mutateAsync({ id: editing.id, data: basePayload })
      onClose()
      return
    }

    if (state.isInstallment && state.createFutureInstallments && state.installmentCount >= 2) {
      const groupId = crypto.randomUUID()
      let firstId: string | null = null
      const perInstallment = Math.floor(state.amountCents / state.installmentCount)
      const remainder = state.amountCents - perInstallment * (state.installmentCount - 1)
      for (let i = 0; i < state.installmentCount; i++) {
        const num = i + 1
        const override = state.installmentOverrides[num]
        const defaultCents = i === state.installmentCount - 1 ? remainder : perInstallment
        const installDate = override?.date ?? format(addMonths(parseISO(state.date), i), 'yyyy-MM-dd')
        const installAmount = override?.amountStr !== undefined
          ? (parseFloat(override.amountStr.replace(',', '.')) || defaultCents / 100)
          : defaultCents / 100
        const result = await create.mutateAsync({
          ...basePayload,
          amount: installAmount,
          date: installDate,
          description: `${state.description.trim()} (${num}/${state.installmentCount})`,
          installment_number: num,
          installment_group_id: groupId,
        })
        if (i === 0) firstId = result?.id ?? null
      }
      state.setCreatedId(firstId)
    } else {
      const result = await create.mutateAsync({
        ...basePayload,
        description: state.isInstallment
          ? `${state.description.trim()} (1/${state.installmentCount})`
          : state.description.trim(),
        installment_number: state.isInstallment ? 1 : undefined,
        installment_group_id: state.isInstallment ? crypto.randomUUID() : undefined,
      })
      state.setCreatedId(result?.id ?? null)
    }

    state.setPhase('payment-prompt')
  }

  const validatePayment = () => {
    let ok = true
    if (!state.paymentMethod) { state.setMethodError(t('transactions_payment_methodRequired')); ok = false }
    else state.setMethodError('')
    if (state.paymentMethod === 'bank' && !state.bankId) { ok = false }
    return ok
  }

  const handleRegisterPayment = async () => {
    if (!state.createdId || !state.paidAt || !validatePayment()) return
    await update.mutateAsync({
      id: state.createdId,
      data: {
        is_paid: true,
        paid_at: state.paidAt,
        payment_method: state.paymentMethod ?? undefined,
        bank_id: state.paymentMethod === 'bank' ? state.bankId ?? undefined : undefined,
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

  const wizardKeyRef = useRef<(e: KeyboardEvent) => void>(() => {})
  wizardKeyRef.current = (e: KeyboardEvent) => {
    const target = e.target as HTMLElement

    if (state.phase === 'payment-prompt') {
      if (e.key === 'Enter') { e.preventDefault(); state.setPhase('payment-form') }
      return
    }

    if (state.phase === 'payment-form') {
      if (e.key === 'Enter' && !update.isPending) { e.preventDefault(); handleRegisterPayment() }
      return
    }

    if (state.phase !== 'wizard') return
    if (target.tagName === 'TEXTAREA') return

    if (state.step === 7) return // contact — handled by combobox

    if (state.step === 4) {
      if (e.key === 'Enter') { e.preventDefault(); if (validateAmount()) state.goTo(5) }
      return
    }

    if (state.step === 1) {
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        e.preventDefault()
        // Toggle type without auto-advancing — just update the selection
        const next = state.type === 'income' ? 'expense' : 'income'
        state.setType(next)
        state.setNature(null)
      }
      if (e.key === 'Enter' && state.type) { e.preventDefault(); state.goTo(2) }
      return
    }

    if (state.step === 2) {
      if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
        e.preventDefault()
        const natures = state.type === 'income' ? INCOME_NATURES : EXPENSE_NATURES
        const options = natures.map((n) => n.value)
        const currentIdx = state.nature == null ? -1 : options.indexOf(state.nature)
        const nextIdx = e.key === 'ArrowDown'
          ? (currentIdx + 1) % options.length
          : (currentIdx - 1 + options.length) % options.length
        state.setNature(options[nextIdx])
      }
      if (e.key === 'Enter' && state.nature) { e.preventDefault(); state.goTo(3) }
      return
    }

    if (state.step === 5) {
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        e.preventDefault()
        state.setIsInstallment(!state.isInstallment)
      }
      if (e.key === 'Enter') { e.preventDefault(); handleNext() }
      return
    }

    if (state.step === 6) {
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        e.preventDefault()
        const filtered = categories.filter((c) => c.type === state.type)
        const options: (string | undefined)[] = [...filtered.map((c) => c.id), undefined]
        const currentIdx = state.categoryId === undefined ? options.length - 1 : options.indexOf(state.categoryId)
        const nextIdx = e.key === 'ArrowRight'
          ? (currentIdx + 1) % options.length
          : (currentIdx - 1 + options.length) % options.length
        state.setCategoryId(options[nextIdx])
      }
      if (e.key === 'Enter') { e.preventDefault(); isCreating ? state.goTo(7) : handleNext() }
      return
    }

    if (e.key !== 'Enter') return

    if (state.step === 8) {
      if (!isPending && state.description.trim()) { e.preventDefault(); handleSave() }
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
    if (!state.isInstallment || state.installmentCount < 2 || state.amountCents <= 0 || !state.date) return null
    const perInstallment = Math.floor(state.amountCents / state.installmentCount)
    const remainder = state.amountCents - perInstallment * (state.installmentCount - 1)
    return Array.from({ length: state.installmentCount }, (_, i) => ({
      number: i + 1,
      rawDate: format(addMonths(parseISO(state.date), i), 'yyyy-MM-dd'),
      cents: i === state.installmentCount - 1 ? remainder : perInstallment,
    }))
  })()

  const getOverrideDate = (num: number, rawDate: string) => state.installmentOverrides[num]?.date ?? rawDate
  const getOverrideAmountStr = (num: number, cents: number) =>
    state.installmentOverrides[num]?.amountStr ?? (cents / 100).toFixed(2).replace('.', ',')

  const updateInstallmentOverride = (num: number, field: 'date' | 'amountStr', value: string) => {
    const base = installmentPreview?.find((p) => p.number === num)
    const current = state.installmentOverrides[num] ?? {
      date: base?.rawDate ?? '',
      amountStr: base ? (base.cents / 100).toFixed(2).replace('.', ',') : '0',
    }
    state.setInstallmentOverrides({ ...state.installmentOverrides, [num]: { ...current, [field]: value } })
  }

  const installmentEditedTotal = installmentPreview
    ? installmentPreview.reduce((sum, p) => {
        const str = state.installmentOverrides[p.number]?.amountStr
        return sum + (str !== undefined ? parseFloat(str.replace(',', '.')) || 0 : p.cents / 100)
      }, 0)
    : 0
  const installmentTotalChanged =
    !!installmentPreview && Math.abs(installmentEditedTotal - state.amountCents / 100) > 0.005

  // ── Step content ────────────────────────────────────────────

  const stepContent: Record<Step, React.ReactNode> = {
    // Step 1 — Entrada ou Saída
    1: (
      <div className="flex flex-col gap-3">
        <p className="text-sm text-[var(--text-muted)] text-center mb-1">
          {t('transactions_wizard_step1Label')}
        </p>
        <div className="grid grid-cols-2 gap-3">
          {([['income', TrendingUp, 'transactions_wizard_entrada'], ['expense', TrendingDown, 'transactions_wizard_saida']] as const).map(([v, Icon, labelKey]) => (
            <button
              key={v}
              type="button"
              onClick={() => state.selectType(v)}
              className={`flex flex-col items-center gap-3 py-6 rounded-xl border-2 transition-all cursor-pointer ${
                state.type === v
                  ? v === 'income'
                    ? 'border-[var(--success)] bg-[var(--success)]/10'
                    : 'border-[var(--danger)] bg-[var(--danger)]/10'
                  : 'border-[var(--bg-border)] hover:bg-[var(--bg-elevated)]'
              }`}
            >
              <Icon className={`h-8 w-8 ${
                state.type === v
                  ? v === 'income' ? 'text-[var(--success)]' : 'text-[var(--danger)]'
                  : 'text-[var(--text-muted)]'
              }`} />
              <span className={`text-sm font-medium ${
                state.type === v
                  ? v === 'income' ? 'text-[var(--success)]' : 'text-[var(--danger)]'
                  : 'text-[var(--text-secondary)]'
              }`}>
                {t(labelKey)}
              </span>
            </button>
          ))}
        </div>
      </div>
    ),

    // Step 2 — Natureza contábil
    2: (() => {
      const natures = state.type === 'income' ? INCOME_NATURES : EXPENSE_NATURES
      return (
        <div className="flex flex-col gap-3">
          <p className="text-sm text-[var(--text-muted)] text-center mb-1">
            {t('transactions_wizard_step2Label')}
          </p>
          <div className="flex flex-col gap-2">
            {natures.map(({ value, labelKey, descKey, icon: Icon, common }) => (
              <button
                key={value}
                type="button"
                onClick={() => state.selectNature(value)}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl border-2 transition-all cursor-pointer text-left ${
                  state.nature === value
                    ? state.type === 'income'
                      ? 'border-[var(--success)] bg-[var(--success)]/10'
                      : 'border-[var(--danger)] bg-[var(--danger)]/10'
                    : 'border-[var(--bg-border)] hover:bg-[var(--bg-elevated)]'
                }`}
              >
                <Icon className={`h-5 w-5 shrink-0 ${
                  state.nature === value
                    ? state.type === 'income' ? 'text-[var(--success)]' : 'text-[var(--danger)]'
                    : 'text-[var(--text-muted)]'
                }`} />
                <div className="flex flex-col min-w-0">
                  <span className="flex items-center gap-2">
                    <span className={`text-sm font-medium leading-tight ${
                      state.nature === value ? 'text-[var(--text-primary)]' : 'text-[var(--text-secondary)]'
                    }`}>
                      {t(labelKey)}
                    </span>
                    {common && (
                      <span className="shrink-0 rounded-full bg-[var(--bg-border)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--text-muted)] leading-none">
                        {t('transactions_nature_common')}
                      </span>
                    )}
                  </span>
                  <span className="text-xs text-[var(--text-muted)] leading-tight mt-0.5">
                    {t(descKey)}
                  </span>
                </div>
              </button>
            ))}
          </div>
        </div>
      )
    })(),

    // Step 3 — Data de competência
    3: (() => {
      const parsed = state.date ? parse(state.date, 'yyyy-MM-dd', new Date()) : undefined
      const selected = parsed && isValid(parsed) ? parsed : undefined
      const locale = language === 'en' ? enUS : ptBR
      return (
        <div className="flex flex-col items-center gap-5">
          <p className="text-sm text-[var(--text-muted)] text-center">
            {state.type === 'income'
              ? t('transactions_wizard_dateIncomeLabel')
              : t('transactions_wizard_dateExpenseLabel')}
          </p>
          <DayCalendar
            selected={selected}
            onSelect={(d) => state.setDate(format(d, 'yyyy-MM-dd'))}
            locale={locale}
          />
        </div>
      )
    })(),

    // Step 4 — Valor
    4: (
      <div className="flex flex-col gap-5">
        <p className="text-sm text-[var(--text-muted)] text-center">
          {t('transactions_wizard_amountLabel')}
        </p>
        <div className="flex flex-col items-center gap-1">
          <div className="flex items-baseline gap-2">
            <span className={`text-xl font-medium ${
              state.type === 'income' ? 'text-[var(--success)]' : 'text-[var(--danger)]'
            }`}>R$</span>
            <input
              ref={state.amountRef}
              type="text"
              inputMode="numeric"
              value={state.formatCents(state.amountCents)}
              onChange={() => {}}
              onKeyDown={handleAmountKey}
              className={`w-56 font-semibold text-center bg-transparent outline-none border-b-2 pb-1 transition-all text-[var(--text-primary)] ${
                state.amountError ? 'border-[var(--danger)]' : 'border-[var(--bg-border)] focus:border-[var(--accent)]'
              } ${
                state.formatCents(state.amountCents).length <= 6 ? 'text-5xl' :
                state.formatCents(state.amountCents).length <= 7 ? 'text-4xl' : 'text-3xl'
              }`}
            />
          </div>
          {state.amountError && <p className="text-xs text-[var(--danger)]">{state.amountError}</p>}
        </div>
      </div>
    ),

    // Step 5 — Parcelamento
    5: (
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
              onClick={() => state.setIsInstallment(v)}
              className={`flex flex-col items-center gap-3 py-6 rounded-xl border-2 transition-all cursor-pointer ${
                state.isInstallment === v
                  ? 'border-[var(--accent)] bg-[var(--accent)]/10'
                  : 'border-[var(--bg-border)] hover:bg-[var(--bg-elevated)]'
              }`}
            >
              <Icon className={`h-8 w-8 ${
                state.isInstallment === v ? 'text-[var(--accent)]' : 'text-[var(--text-muted)]'
              }`} />
              <span className={`text-sm font-medium ${
                state.isInstallment === v ? 'text-[var(--accent)]' : 'text-[var(--text-secondary)]'
              }`}>
                {label}
              </span>
            </button>
          ))}
        </div>

        {state.isInstallment && (
          <div className="flex flex-col gap-3 mt-2 pl-1">
            <Input
              label={t('transactions_installmentCount')}
              type="number"
              min="2"
              max="120"
              value={String(state.installmentCount)}
              onChange={(e) => state.setInstallmentCount(Math.max(2, parseInt(e.target.value) || 2))}
            />
            {isCreating && (
              <Checkbox
                label={t('transactions_createFutureInstallments')}
                checked={state.createFutureInstallments}
                onChange={(e) => state.setCreateFutureInstallments(e.target.checked)}
              />
            )}
            {installmentPreview && (
              <div className="flex flex-col gap-1 rounded-lg border border-[var(--bg-border)] overflow-hidden">
                <div className="grid grid-cols-[2rem_1fr_6.5rem] gap-2 px-3 py-1.5 bg-[var(--bg-elevated)] border-b border-[var(--bg-border)]">
                  <span className="text-xs text-[var(--text-muted)]">#</span>
                  <span className="text-xs text-[var(--text-muted)]">{t('transactions_date')}</span>
                  <span className="text-xs text-[var(--text-muted)] text-right">{t('transactions_amount')}</span>
                </div>

                <div className="max-h-44 overflow-y-auto divide-y divide-[var(--bg-border)]">
                  {installmentPreview.map((p) =>
                    state.createFutureInstallments ? (
                      <div key={p.number} className="grid grid-cols-[2rem_1fr_6.5rem] items-center gap-2 px-3 py-1.5 hover:bg-[var(--bg-elevated)]">
                        <span className="text-xs font-mono text-[var(--text-muted)] text-center">
                          {p.number}/{state.installmentCount}
                        </span>
                        <input
                          type="date"
                          value={getOverrideDate(p.number, p.rawDate)}
                          onChange={(e) => updateInstallmentOverride(p.number, 'date', e.target.value)}
                          className="h-7 px-2 rounded-[var(--radius-md)] bg-[var(--bg-elevated)] border border-[var(--bg-border)] text-xs text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)] transition-colors w-full"
                        />
                        <div className="flex items-center gap-1 h-7 px-2 rounded-[var(--radius-md)] bg-[var(--bg-elevated)] border border-[var(--bg-border)] focus-within:border-[var(--accent)] transition-colors">
                          <span className="text-xs text-[var(--text-muted)] shrink-0">R$</span>
                          <input
                            type="text"
                            inputMode="decimal"
                            value={getOverrideAmountStr(p.number, p.cents)}
                            onChange={(e) => updateInstallmentOverride(p.number, 'amountStr', e.target.value)}
                            className="flex-1 bg-transparent text-xs text-right text-[var(--text-primary)] font-mono outline-none min-w-0"
                          />
                        </div>
                      </div>
                    ) : (
                      <div key={p.number} className="grid grid-cols-[2rem_1fr_6.5rem] items-center gap-2 px-3 py-2">
                        <span className="text-xs font-mono text-[var(--text-muted)] text-center">
                          {p.number}/{state.installmentCount}
                        </span>
                        <span className="text-xs text-[var(--text-secondary)]">
                          {format(parseISO(p.rawDate), 'dd/MM/yyyy')}
                        </span>
                        <span className={`text-xs font-medium tabular-nums text-right ${
                          state.type === 'income' ? 'text-[var(--success)]' : 'text-[var(--danger)]'
                        }`}>
                          R$ {state.formatCents(p.cents)}
                        </span>
                      </div>
                    )
                  )}
                </div>

                <div className="grid grid-cols-[2rem_1fr_auto] items-center gap-2 px-3 py-1.5 bg-[var(--bg-elevated)] border-t border-[var(--bg-border)]">
                  <span />
                  <span className="text-xs text-[var(--text-muted)]">{t('transactions_installment_total')}</span>
                  <div className="flex items-center gap-2 text-xs font-mono">
                    {installmentTotalChanged ? (
                      <>
                        <span className="text-[var(--text-muted)] line-through">
                          {(state.amountCents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                        </span>
                        <span className="text-[var(--warning)] font-medium">
                          {installmentEditedTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                        </span>
                      </>
                    ) : (
                      <span className="text-[var(--text-secondary)]">
                        {(state.amountCents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    ),

    // Step 6 — Categoria
    6: (() => {
      const filtered = categories.filter((c) => c.type === state.type)
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
                  state.categoryId === cat.id
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
                state.categoryId === undefined
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

    // Step 7 — Contato / Contraparte
    7: (
      <div className="flex flex-col gap-5">
        <p className="text-sm text-[var(--text-muted)] text-center">
          {state.type === 'income'
            ? t('transactions_wizard_counterpartIncomeLabel')
            : t('transactions_wizard_counterpartExpenseLabel')}
        </p>
        <ContactCombobox
          value={state.counterpart}
          onChange={(name, contact) => {
            state.setCounterpart(name)
            state.setContactSearch(name)
            state.setContactId(contact?.id)
          }}
          onAddNew={(name) => {
            state.setContactModalInitialName(name)
            state.setContactModalOpen(true)
          }}
          onConfirm={handleNext}
          contacts={contacts}
          placeholder={t('contact_searchPlaceholder')}
          addLabel={t('transactions_wizard_counterpartAdd')}
        />
      </div>
    ),

    // Step 8 — Detalhes
    8: (
      <div className="flex flex-col gap-4">
        <p className="text-sm text-[var(--text-muted)] text-center mb-1">
          {t('transactions_wizard_detailsLabel')}
        </p>
        <Input
          label={t('transactions_description')}
          value={state.description}
          onChange={(e) => { state.setDescription(e.target.value); state.setDescError('') }}
          error={state.descError}
        />
        <Input
          label={`${t('transactions_notes')} (${t('transactions_wizard_optional')})`}
          value={state.notes}
          onChange={(e) => state.setNotes(e.target.value)}
        />
      </div>
    ),
  }

  // ── Render ──────────────────────────────────────────────────

  const showNext = state.step < 8 && (
    state.step === 2 ||
    state.step === 3 ||
    state.step === 4 ||
    state.step === 5 ||
    state.step === 6 ||
    (state.step === 7 && state.counterpart.trim().length > 0) ||
    !!editing
  )
  const nextDisabled =
    (state.step === 1 && !state.type) ||
    (state.step === 2 && !state.nature)

  const modalTitle = state.phase === 'payment-form'
    ? (state.type === 'income' ? t('transactions_payment_formTitleIncome') : t('transactions_payment_formTitle'))
    : editing
    ? t('transactions_editTitle')
    : t('transactions_newTitle')

  const keyboardHint = (() => {
    if (state.phase === 'payment-prompt') return t('transactions_wizard_keyHintPaymentPrompt')
    if (state.phase === 'payment-form') return t('transactions_wizard_keyHintPaymentForm')
    if (state.step === 1 || state.step === 5 || state.step === 6) return t('transactions_wizard_keyHintCards')
    if (state.step === 2) return t('transactions_wizard_keyHintNature')
    if (state.step === 7) return t('transactions_wizard_keyHintContact')
    if (state.step === 8) return t('transactions_wizard_keyHintSave')
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
        {state.phase === 'wizard' && (
          <>
            <div className="flex justify-center gap-2 mb-6">
              {([1, 2, 3, 4, 5, 6, 7, 8] as const).map((s) => (
                <div
                  key={s}
                  className={`h-1.5 rounded-full transition-all duration-200 ${
                    s === state.step
                      ? 'w-6 bg-[var(--accent)]'
                      : s < state.step
                      ? 'w-3 bg-[var(--accent)] opacity-40'
                      : 'w-3 bg-[var(--bg-border)]'
                  }`}
                />
              ))}
            </div>

            <div className="min-h-52">{stepContent[state.step]}</div>

            <div className="flex items-center justify-between mt-6 pt-4 border-t border-[var(--bg-border)]">
              <div>
                {state.step === 1 ? (
                  <Button variant="ghost" size="sm" onClick={onClose}>
                    {t('transactions_cancel')}
                  </Button>
                ) : (
                  <Button variant="ghost" size="sm" onClick={state.goBack}>
                    <ChevronLeft className="h-4 w-4" />
                    {t('transactions_wizard_back')}
                  </Button>
                )}
              </div>
              <div className="flex gap-2">
                {editing && state.step === 8 && (
                  <Button variant="danger" size="sm" onClick={handleDelete} loading={deleteT.isPending}>
                    {t('transactions_delete')}
                  </Button>
                )}
                {showNext && (
                  <Button onClick={handleNext} disabled={nextDisabled}>
                    {t('transactions_wizard_next')}
                  </Button>
                )}
                {state.step === 8 && (
                  <Button onClick={handleSave} loading={isPending} disabled={!state.description.trim()}>
                    {t('transactions_save')}
                  </Button>
                )}
              </div>
            </div>
          </>
        )}

        {/* ── Payment prompt phase ── */}
        {state.phase === 'payment-prompt' && (
          <PaymentPromptStep
            type={state.type ?? 'expense'}
            onRegisterPayment={() => state.setPhase('payment-form')}
            onSkip={onClose}
            skipCountdown={state.skipCountdown}
          />
        )}

        {/* ── Payment form phase ── */}
        {state.phase === 'payment-form' && (
          <PaymentFormStep
            type={state.type ?? 'expense'}
            paidAt={state.paidAt}
            setPaidAt={state.setPaidAt}
            paymentMethod={state.paymentMethod}
            setPaymentMethod={state.setPaymentMethod}
            bankId={state.bankId}
            setBankId={state.setBankId}
            methodError={state.methodError}
            setMethodError={state.setMethodError}
            banks={banks}
            language={language}
            onBack={() => state.setPhase('payment-prompt')}
            onConfirm={handleRegisterPayment}
            isLoading={update.isPending}
          />
        )}

      </Modal>

      {/* Quick-add contact — rendered outside wizard modal so both stack */}
      <ContactModal
        open={state.contactModalOpen}
        onClose={() => state.setContactModalOpen(false)}
        initialName={state.contactModalInitialName}
        onCreated={(contact) => {
          state.setCounterpart(contact.name)
          state.setContactSearch(contact.name)
          state.setContactId(contact.id)
          state.setContactModalOpen(false)
        }}
      />
    </>
  )
}
