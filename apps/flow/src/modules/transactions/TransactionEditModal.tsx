import { useEffect, useRef, useState } from 'react'
import { Repeat } from 'lucide-react'
import { Button, Checkbox, DatePicker, Input, Modal, Select, useToast } from '@syncero/ui'
import { useT } from '@/i18n'
import { useCategories, useContacts } from './queries'
import { useUpdateTransaction, useDeleteTransaction } from './mutations'
import { updateTransactionGroup } from '@/lib/backend'
import { ContactModal } from './ContactModal'
import { ContactCombobox } from './ContactCombobox'
import type { Transaction, TransactionNature, TransactionType } from '@/types'

// ── Label wrapper ────────────────────────────────────────────

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <span className="text-xs font-medium text-[var(--text-secondary)]">{children}</span>
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
  const [nature, setNature] = useState<TransactionNature | ''>('')
  const [isPaid, setIsPaid] = useState(false)
  const [paidAt, setPaidAt] = useState('')
  const [descError, setDescError] = useState('')
  const [amountError, setAmountError] = useState('')
  const [natureError, setNatureError] = useState('')
  const [counterpartError, setCounterpartError] = useState('')
  const [paidAtError, setPaidAtError] = useState('')

  const [applyToGroup, setApplyToGroup] = useState(false)
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
    setNature((transaction.nature as TransactionNature | null) ?? '')
    setIsPaid(transaction.is_paid)
    setPaidAt(transaction.paid_at ?? '')
    setCounterpart(transaction.contacts?.name ?? transaction.counterpart ?? '')
    setContactId(transaction.contact_id ?? undefined)
    setContactSearch('')
    setDescError('')
    setAmountError('')
    setNatureError('')
    setCounterpartError('')
    setPaidAtError('')
    setConfirmDelete(false)
    setApplyToGroup(false)
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
    if (!nature) { setNatureError(t('transactions_errorNature')); return }
    if (!counterpart.trim()) { setCounterpartError(t('transactions_errorCounterpart')); return }
    if (isPaid && !paidAt) { setPaidAtError(t('transactions_errorPaidAt')); return }

    try {
      await update.mutateAsync({
        id: transaction.id,
        data: {
          type,
          date,
          amount: amountCents / 100,
          category_id: categoryId || null,
          description: description.trim(),
          nature: nature || null,
          notes: notes.trim() || null,
          counterpart: counterpart.trim() || null,
          contact_id: contactId ?? null,
          is_paid: isPaid,
          paid_at: isPaid && paidAt ? paidAt : null,
          is_installment: transaction.is_installment,
          installment_count: transaction.installment_count ?? null,
          installment_number: transaction.installment_number ?? null,
          installment_group_id: transaction.installment_group_id ?? null,
        },
      })
      if (applyToGroup && transaction.installment_group_id && nature) {
        await updateTransactionGroup(transaction.installment_group_id, { nature: nature || null })
      }
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
        <Button size="sm" onClick={handleSave} loading={update.isPending} disabled={!description.trim() || amountCents <= 0}>
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
          <div className="flex flex-col gap-1.5">
            <FieldLabel>{t('transactions_type')}</FieldLabel>
            <div className="flex gap-2">
              {(['income', 'expense'] as const).map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => { setType(v); setCategoryId(''); setNature(''); setNatureError('') }}
                  className={`flex-1 py-1.5 rounded text-sm font-medium transition-colors cursor-pointer ${
                    type === v
                      ? v === 'income'
                        ? 'bg-[var(--success)] text-white'
                        : 'bg-[var(--danger)] text-white'
                      : 'bg-[var(--bg-elevated)] text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
                  }`}
                >
                  {v === 'income' ? t('transactions_wizard_entrada') : t('transactions_wizard_saida')}
                </button>
              ))}
            </div>
          </div>

          {/* Nature */}
          <div className="flex flex-col gap-1.5">
            <Select
              label={t('transactions_nature')}
              value={nature}
              onChange={(v) => { setNature(v as TransactionNature | ''); setNatureError('') }}
              options={[
                { value: '', label: t('common_select') },
                ...(type === 'income' ? [
                  { value: 'sale_service',         label: t('transactions_nature_sale_service') },
                  { value: 'loan_received',        label: t('transactions_nature_loan_received') },
                  { value: 'capital_contribution', label: t('transactions_nature_capital_contribution') },
                ] : [
                  { value: 'operational_expense',  label: t('transactions_nature_operational_expense') },
                  { value: 'product_cost',         label: t('transactions_nature_product_cost') },
                  { value: 'asset_purchase',       label: t('transactions_nature_asset_purchase') },
                  { value: 'debt_payment',         label: t('transactions_nature_debt_payment') },
                  { value: 'owner_withdrawal',     label: t('transactions_nature_owner_withdrawal') },
                ]),
              ]}
            />
            {natureError && <p className="text-xs text-[var(--danger)]">{natureError}</p>}
            {transaction?.installment_group_id && nature && (
              <Checkbox
                label={t('transactions_applyNatureToGroup')}
                checked={applyToGroup}
                onChange={(e) => setApplyToGroup(e.target.checked)}
              />
            )}
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

          {/* Counterpart / Contact */}
          <div className="flex flex-col gap-1.5">
            <FieldLabel>
              {type === 'income'
                ? t('transactions_wizard_counterpartIncomeLabel')
                : t('transactions_wizard_counterpartExpenseLabel')}
            </FieldLabel>
            <ContactCombobox
              value={counterpart}
              onChange={(name, contact) => {
                setCounterpart(name)
                setContactSearch(name)
                setContactId(contact?.id)
                setCounterpartError('')
              }}
              onAddNew={(name) => {
                setContactModalInitialName(name)
                setContactModalOpen(true)
              }}
              contacts={contacts}
              placeholder={t('contact_searchPlaceholder')}
              addLabel={t('transactions_wizard_counterpartAdd')}
            />
            {counterpartError && <p className="text-xs text-[var(--danger)]">{counterpartError}</p>}
          </div>

          {/* Description */}
          <Input
            label={t('transactions_description')}
            value={description}
            onChange={(e) => { setDescription(e.target.value); setDescError('') }}
            error={descError}
          />

          {/* Status */}
          <div className="flex flex-col gap-1.5">
            <FieldLabel>{t('transactions_status')}</FieldLabel>
            <div className="flex gap-2">
              {([false, true] as const).map((paid) => (
                <button
                  key={String(paid)}
                  type="button"
                  onClick={() => { setIsPaid(paid); if (!paid) { setPaidAt(''); setPaidAtError('') } }}
                  className={`flex-1 py-1.5 rounded text-sm font-medium transition-colors cursor-pointer ${
                    isPaid === paid
                      ? 'bg-[var(--accent)] text-white'
                      : 'bg-[var(--bg-elevated)] text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
                  }`}
                >
                  {paid
                    ? (type === 'income' ? t('transactions_received') : t('transactions_paid'))
                    : (type === 'income' ? t('transactions_toReceive') : t('transactions_pending'))}
                </button>
              ))}
            </div>
          </div>

          {/* Paid at */}
          {isPaid && (
            <DatePicker
              label={type === 'income' ? t('transactions_receivedAt') : t('transactions_paidAt')}
              value={paidAt}
              onChange={(v) => { setPaidAt(v); setPaidAtError('') }}
              language={language}
              error={paidAtError}
            />
          )}

          {/* Category */}
          <Select
            label={`${t('transactions_category')} (${t('transactions_wizard_optional')})`}
            placeholder={t('transactions_noCategory')}
            value={categoryId}
            onChange={setCategoryId}
            options={filteredCategories.map((c) => ({ value: c.id, label: c.name }))}
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
