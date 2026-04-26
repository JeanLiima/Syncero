import { useEffect, useState } from 'react'
import { format } from 'date-fns'
import { Plus, Landmark } from 'lucide-react'
import { Button, DatePicker, Input, Modal, Select } from '@syncero/ui'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useT } from '@/i18n'
import { useAuthStore } from '@/store/auth'
import { createBank } from '@/lib/backend'
import type { Bank } from '@/types'
import { useBanks } from './queries'
import { useUpdateTransaction } from './mutations'

// ── Quick-create bank modal ──────────────────────────────────

export function BankQuickModal({
  open,
  onClose,
  onCreated,
}: {
  open: boolean
  onClose: () => void
  onCreated: (bank: Bank) => void
}) {
  const t = useT()
  const qc = useQueryClient()
  const activeCompany = useAuthStore((s) => s.activeCompany)
  const [name, setName] = useState('')

  useEffect(() => { if (open) setName('') }, [open])

  const save = useMutation({
    mutationFn: () => createBank({ company_id: activeCompany!.id, name: name.trim() }),
    onSuccess: (bank) => {
      qc.invalidateQueries({ queryKey: ['banks', activeCompany?.id] })
      onCreated(bank)
    },
  })

  return (
    <Modal open={open} onClose={onClose} title={t('bank_newTitle')} size="sm">
      <Input
        label={t('bank_name')}
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter' && name.trim() && !save.isPending) save.mutate() }}
        autoFocus
      />
      <div className="flex items-center justify-end gap-3 mt-6 pt-4 border-t border-[var(--bg-border)]">
        <Button variant="ghost" size="sm" onClick={onClose}>{t('transactions_cancel')}</Button>
        <Button onClick={() => save.mutate()} loading={save.isPending} disabled={!name.trim()}>
          {t('transactions_save')}
        </Button>
      </div>
    </Modal>
  )
}

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

      <BankQuickModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onCreated={(bank) => { onChange(bank.id); setModalOpen(false) }}
      />
    </>
  )
}

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
          {t('transactions_payment_confirm')}
        </Button>
      </div>
    </Modal>
  )
}
