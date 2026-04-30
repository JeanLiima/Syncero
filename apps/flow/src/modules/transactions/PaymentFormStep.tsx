import { ChevronLeft, Wallet, Landmark } from 'lucide-react'
import { DatePicker, Button } from '@syncero/ui'
import { useT } from '@/i18n'
import { BankSelectField } from './PaymentModal'
import type { Bank, TransactionType } from '@/types'

interface PaymentFormStepProps {
  type: TransactionType
  paidAt: string
  setPaidAt: (date: string) => void
  paymentMethod: 'cash' | 'bank' | null
  setPaymentMethod: (method: 'cash' | 'bank' | null) => void
  bankId: string | undefined
  setBankId: (id: string | undefined) => void
  methodError: string
  setMethodError: (error: string) => void
  banks: Bank[]
  language: 'pt' | 'en'
  onBack: () => void
  onConfirm: () => void
  isLoading: boolean
}

const METHOD_OPTIONS = [
  { value: 'cash' as const, icon: Wallet,    labelKey: 'transactions_paymentCash',      descKey: 'transactions_paymentCash_desc'  },
  { value: 'bank' as const, icon: Landmark,  labelKey: 'transactions_paymentBank',      descKey: 'transactions_paymentBank_desc'  },
] as const

export function PaymentFormStep({
  type,
  paidAt,
  setPaidAt,
  paymentMethod,
  setPaymentMethod,
  bankId,
  setBankId,
  methodError,
  setMethodError,
  banks,
  language,
  onBack,
  onConfirm,
  isLoading,
}: PaymentFormStepProps) {
  const t = useT()
  const isIncome = type === 'income'
  const activeColor = isIncome ? 'income' : 'expense'

  return (
    <>
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
            {METHOD_OPTIONS.map(({ value, icon: Icon, labelKey, descKey }) => (
              <button
                key={value}
                type="button"
                onClick={() => {
                  setPaymentMethod(value)
                  setMethodError('')
                  if (value !== 'bank') setBankId(undefined)
                }}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl border-2 transition-all cursor-pointer text-left ${
                  paymentMethod === value
                    ? activeColor === 'income'
                      ? 'border-[var(--success)] bg-[var(--success)]/10'
                      : 'border-[var(--danger)] bg-[var(--danger)]/10'
                    : 'border-[var(--bg-border)] hover:bg-[var(--bg-elevated)]'
                }`}
              >
                <Icon className={`h-5 w-5 shrink-0 ${
                  paymentMethod === value
                    ? activeColor === 'income' ? 'text-[var(--success)]' : 'text-[var(--danger)]'
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
          {methodError && <p className="text-xs text-[var(--danger)]">{methodError}</p>}
        </div>

        {paymentMethod === 'bank' && (
          <BankSelectField
            label={t('transactions_bankAccount')}
            value={bankId ?? ''}
            onChange={(v) => setBankId(v || undefined)}
            banks={banks}
          />
        )}
      </div>

      <div className="flex items-center justify-between mt-6 pt-4 border-t border-[var(--bg-border)]">
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ChevronLeft className="h-4 w-4" />
          {t('transactions_wizard_back')}
        </Button>
        <Button
          onClick={onConfirm}
          loading={isLoading}
          disabled={!paidAt || !paymentMethod || (paymentMethod === 'bank' && !bankId)}
        >
          {isIncome ? t('transactions_payment_confirmIncome') : t('transactions_payment_confirm')}
        </Button>
      </div>
    </>
  )
}
