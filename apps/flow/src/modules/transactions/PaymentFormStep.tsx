import { ChevronLeft } from 'lucide-react'
import { DatePicker, Select, Button } from '@syncero/ui'
import { useT } from '@/i18n'
import { BankSelectField } from './PaymentModal'
import type { Bank } from '@/types'

interface PaymentFormStepProps {
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

export function PaymentFormStep({
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

  return (
    <>
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
              if (v !== 'bank') setBankId(undefined)
            }}
            options={[
              { value: 'cash', label: t('transactions_paymentCash') },
              { value: 'bank', label: t('transactions_paymentBank') },
            ]}
          />
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
          {t('transactions_payment_confirm')}
        </Button>
      </div>
    </>
  )
}