import { useEffect, useState } from 'react'
import { format } from 'date-fns'
import { Plus, Landmark, Wallet } from 'lucide-react'
import { Button, DatePicker, Modal, Select, useToast } from '@syncero/ui'
import { useT } from '@/i18n'
import { BankFormModal } from '@/modules/banks/BankFormModal'
import type { Bank, TransactionType } from '@/types'
import { useBanks } from './queries'
import { useUpdateTransaction } from './mutations'
import { useAuthStore } from '@/store/auth'

// ── Reusable bank select with empty-state + quick-create ─────

export function BankSelectField({
  value,
  onChange,
  banks,
  label,
}: {
  value: string
  onChange: (id: string) => void
  banks: Bank[]
  label: string
}) {
  const t = useT()
  const [modalOpen, setModalOpen] = useState(false)

  return (
    <>
      {banks.length === 0 ? (
        <div className="flex flex-col gap-2">
          <span className="text-sm font-medium text-[var(--text-secondary)]">{label}</span>
          <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-[var(--bg-border)] py-5 px-4">
            <Landmark className="h-7 w-7 text-[var(--text-muted)]" />
            <p className="text-sm text-[var(--text-muted)] text-center">{t('transactions_payment_noBanks')}</p>
            <Button size="sm" variant="ghost" onClick={() => setModalOpen(true)}>
              <Plus className="h-3.5 w-3.5" />
              {t('transactions_payment_createBank')}
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-1.5">
          <Select
            label={label}
            placeholder={t('common_select')}
            value={value}
            onChange={onChange}
            options={banks.map((b) => ({ value: b.id, label: b.name }))}
          />
          <button
            type="button"
            onClick={() => setModalOpen(true)}
            className="self-start text-xs text-[var(--accent)] hover:underline cursor-pointer"
          >
            + {t('transactions_payment_newBank')}
          </button>
        </div>
      )}

      <BankFormModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSaved={(bank) => { onChange(bank.id); setModalOpen(false) }}
      />
    </>
  )
}

interface Props {
  transactionId: string | null
  transactionType?: TransactionType
  open: boolean
  onClose: () => void
  language: 'pt' | 'en'
}

export function PaymentModal({ transactionId, transactionType, open, onClose, language }: Props) {
  const t = useT()
  const isIncome = transactionType === 'income'
  const { success, error: toastError } = useToast()
  const user = useAuthStore((s) => s.user)
  const update = useUpdateTransaction()
  const { data: banks = [] } = useBanks()

  const [paidAt, setPaidAt] = useState('')
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'bank' | ''>('')
  const [bankId, setBankId] = useState('')

  useEffect(() => {
    if (open) {
      setPaidAt(format(new Date(), 'yyyy-MM-dd'))
      setPaymentMethod('')
      setBankId('')
    }
  }, [open])

  const canConfirm = !!paidAt && !!paymentMethod && (paymentMethod !== 'bank' || !!bankId)

  const handleConfirm = async () => {
    if (!transactionId || !canConfirm) return
    try {
      await update.mutateAsync({
        id: transactionId,
        data: {
          is_paid: true,
          paid_at: paidAt,
          payment_method: paymentMethod as 'cash' | 'bank',
          bank_id: paymentMethod === 'bank' ? bankId : undefined,
          payment_registered_at: new Date().toISOString(),
          payment_registered_by: user?.id ?? undefined,
        },
      })
      success(isIncome ? t('transactions_paymentReceivedToast') : t('transactions_paymentRegistered'))
      onClose()
    } catch {
      toastError(t('common_errorGeneric'))
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={isIncome ? t('transactions_payment_formTitleIncome') : t('transactions_payment_formTitle')} size="sm">
      <div className="flex flex-col gap-4">
        <DatePicker
          label={isIncome ? t('transactions_receivedAt') : t('transactions_paidAt')}
          value={paidAt}
          onChange={setPaidAt}
          language={language}
        />

        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-[var(--text-secondary)]">
            {isIncome ? t('transactions_receivementMethod') : t('transactions_paymentMethod')}
          </span>
          <div className="flex flex-col gap-2">
            {([
              { value: 'cash', icon: Wallet,    labelKey: 'transactions_paymentCash',     descKey: 'transactions_paymentCash_desc'  },
              { value: 'bank', icon: Landmark,  labelKey: 'transactions_paymentBank',     descKey: 'transactions_paymentBank_desc'  },
            ] as const).map(({ value, icon: Icon, labelKey, descKey }) => (
              <button
                key={value}
                type="button"
                onClick={() => {
                  setPaymentMethod(value)
                  if (value !== 'bank') setBankId('')
                }}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl border-2 transition-all cursor-pointer text-left ${
                  paymentMethod === value
                    ? isIncome
                      ? 'border-[var(--success)] bg-[var(--success)]/10'
                      : 'border-[var(--danger)] bg-[var(--danger)]/10'
                    : 'border-[var(--bg-border)] hover:bg-[var(--bg-elevated)]'
                }`}
              >
                <Icon className={`h-5 w-5 shrink-0 ${
                  paymentMethod === value
                    ? isIncome ? 'text-[var(--success)]' : 'text-[var(--danger)]'
                    : 'text-[var(--text-muted)]'
                }`} />
                <div className="flex flex-col min-w-0">
                  <span className={`text-sm font-medium leading-tight ${
                    paymentMethod === value ? 'text-[var(--text-primary)]' : 'text-[var(--text-secondary)]'
                  }`}>
                    {t(labelKey)}
                  </span>
                  <span className="text-xs text-[var(--text-muted)] leading-tight mt-0.5">
                    {t(descKey)}
                  </span>
                </div>
              </button>
            ))}
          </div>
        </div>

        {paymentMethod === 'bank' && (
          <BankSelectField
            label={t('transactions_bankAccount')}
            value={bankId}
            onChange={setBankId}
            banks={banks}
          />
        )}
      </div>

      <div className="flex items-center justify-end gap-3 mt-6 pt-4 border-t border-[var(--bg-border)]">
        <Button variant="ghost" size="sm" onClick={onClose}>
          {t('transactions_cancel')}
        </Button>
        <Button onClick={handleConfirm} loading={update.isPending} disabled={!canConfirm}>
          {isIncome ? t('transactions_payment_confirmIncome') : t('transactions_payment_confirm')}
        </Button>
      </div>
    </Modal>
  )
}
