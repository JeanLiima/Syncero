import { useEffect, useState } from 'react'
import { format } from 'date-fns'
import { Button, DatePicker, Modal, Select } from '@syncero/ui'
import { useT } from '@/i18n'
import { useAuthStore } from '@/store/auth'
import { useBanks } from './queries'
import { useUpdateTransaction } from './mutations'

interface Props {
  transactionId: string | null
  open: boolean
  onClose: () => void
  language: 'pt' | 'en'
}

export function PaymentModal({ transactionId, open, onClose, language }: Props) {
  const t = useT()
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
    onClose()
  }

  return (
    <Modal open={open} onClose={onClose} title={t('transactions_payment_formTitle')} size="sm">
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
            value={paymentMethod}
            onChange={(v) => {
              setPaymentMethod(v as 'cash' | 'bank' | '')
              if (v !== 'bank') setBankId('')
            }}
            options={[
              { value: 'cash', label: t('transactions_paymentCash') },
              { value: 'bank', label: t('transactions_paymentBank') },
            ]}
          />
        </div>

        {paymentMethod === 'bank' && (
          <Select
            label={t('transactions_bankAccount')}
            placeholder={t('common_select')}
            value={bankId}
            onChange={setBankId}
            options={banks.map((b) => ({ value: b.id, label: b.name }))}
          />
        )}
      </div>

      <div className="flex items-center justify-end gap-3 mt-6 pt-4 border-t border-[var(--bg-border)]">
        <Button variant="ghost" size="sm" onClick={onClose}>
          {t('transactions_cancel')}
        </Button>
        <Button onClick={handleConfirm} loading={update.isPending} disabled={!canConfirm}>
          {t('transactions_payment_confirm')}
        </Button>
      </div>
    </Modal>
  )
}
