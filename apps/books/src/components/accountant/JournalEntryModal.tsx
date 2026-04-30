import { useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { Modal, Button, Input, Select, DatePicker } from '@syncero/ui'
import { usePreferencesStore } from '@/store/preferences'
import { useT } from '@/i18n'
import type { AccountPlan, JournalSide } from '@/types'

interface EntryLine {
  account_plan_id: string
  side: JournalSide
  amount: string
  memo: string
}

interface JournalEntryFormData {
  entry_date: string
  description: string
  external_ref: string
  lines: Array<{ account_plan_id: string; side: JournalSide; amount: number; memo: string }>
}

interface JournalEntryModalProps {
  open: boolean
  onClose: () => void
  onSubmit: (data: JournalEntryFormData) => Promise<void>
  accounts: Pick<AccountPlan, 'id' | 'code' | 'name'>[]
}

const emptyLine = (): EntryLine => ({ account_plan_id: '', side: 'debit', amount: '', memo: '' })

function parseBrAmount(raw: string): number {
  return parseFloat(raw.replace(',', '.')) || 0
}

export function JournalEntryModal({ open, onClose, onSubmit, accounts }: JournalEntryModalProps) {
  const t = useT()
  const language = usePreferencesStore(s => s.language)
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [description, setDescription] = useState('')
  const [externalRef, setExternalRef] = useState('')
  const [lines, setLines] = useState<EntryLine[]>([emptyLine(), emptyLine()])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const accountOptions = accounts.map(a => ({ value: a.id, label: `${a.code} — ${a.name}` }))

  const debitTotal = lines.filter(l => l.side === 'debit').reduce((s, l) => s + parseBrAmount(l.amount), 0)
  const creditTotal = lines.filter(l => l.side === 'credit').reduce((s, l) => s + parseBrAmount(l.amount), 0)
  const isBalanced = Math.abs(debitTotal - creditTotal) < 0.005

  const updateLine = (i: number, patch: Partial<EntryLine>) => {
    setLines(prev => prev.map((l, idx) => idx === i ? { ...l, ...patch } : l))
  }

  const handleSubmit = async () => {
    setError(null)
    if (!date) { setError(t('lancamentos_errDate')); return }
    if (!description.trim()) { setError(t('lancamentos_errHistory')); return }
    if (lines.some(l => !l.account_plan_id || parseBrAmount(l.amount) <= 0)) {
      setError(t('lancamentos_errLines'))
      return
    }
    if (!isBalanced) { setError(t('lancamentos_errBalance')); return }

    setSubmitting(true)
    try {
      await onSubmit({
        entry_date: date,
        description: description.trim(),
        external_ref: externalRef.trim(),
        lines: lines.map(l => ({ account_plan_id: l.account_plan_id, side: l.side, amount: parseBrAmount(l.amount), memo: l.memo.trim() })),
      })
      setDate(new Date().toISOString().slice(0, 10))
      setDescription('')
      setExternalRef('')
      setLines([emptyLine(), emptyLine()])
      onClose()
    } catch {
      setError(t('lancamentos_errSave'))
    } finally {
      setSubmitting(false)
    }
  }

  const fmt = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

  return (
    <Modal open={open} onClose={onClose} title={t('lancamentos_new')} size="lg">
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-3 gap-4">
          <DatePicker label={t('lancamentos_fieldDate')} value={date} onChange={setDate} language={language} />
          <Input label={t('lancamentos_fieldHistory')} placeholder={t('lancamentos_historyPlaceholder')} className="col-span-2" value={description} onChange={e => setDescription(e.target.value)} />
        </div>
        <Input label={t('lancamentos_fieldRef')} placeholder={t('lancamentos_refPlaceholder')} value={externalRef} onChange={e => setExternalRef(e.target.value)} />

        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-medium text-[var(--text-secondary)]">{t('lancamentos_fieldLines')}</p>
            <button
              type="button"
              onClick={() => setLines(prev => [...prev, emptyLine()])}
              className="cursor-pointer flex items-center gap-1 text-xs text-[var(--accent)] hover:underline"
            >
              <Plus className="h-3 w-3" /> {t('lancamentos_addLine')}
            </button>
          </div>

          <div className="flex flex-col gap-2">
            {lines.map((line, i) => (
              <div key={i} className="grid grid-cols-[1fr_auto_auto_auto_auto] gap-2 items-end">
                <Select
                  placeholder={t('lancamentos_accountPlaceholder')}
                  options={accountOptions}
                  value={line.account_plan_id}
                  onChange={(v) => updateLine(i, { account_plan_id: v })}
                />
                <Select
                  options={[{ value: 'debit', label: 'D' }, { value: 'credit', label: 'C' }]}
                  value={line.side}
                  onChange={(v) => updateLine(i, { side: v as JournalSide })}
                  className="w-20"
                />
                <Input
                  placeholder="0,00"
                  className="w-28"
                  value={line.amount}
                  onChange={e => updateLine(i, { amount: e.target.value })}
                />
                <Input
                  placeholder={t('lancamentos_memoPlaceholder')}
                  className="w-36"
                  value={line.memo}
                  onChange={e => updateLine(i, { memo: e.target.value })}
                />
                <button
                  type="button"
                  disabled={lines.length <= 2}
                  onClick={() => setLines(prev => prev.filter((_, idx) => idx !== i))}
                  className="cursor-pointer h-10 w-10 flex items-center justify-center rounded-[var(--radius-md)] text-[var(--text-muted)] hover:text-[var(--danger)] hover:bg-[var(--bg-elevated)] transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-end gap-6 mt-3 pt-3 border-t border-[var(--bg-border)]">
            <span className="text-xs text-[var(--text-muted)]">
              {t('lancamentos_debits')} <span className="font-mono text-[var(--text-primary)]">{fmt(debitTotal)}</span>
            </span>
            <span className="text-xs text-[var(--text-muted)]">
              {t('lancamentos_credits')} <span className="font-mono text-[var(--text-primary)]">{fmt(creditTotal)}</span>
            </span>
            <span className={`text-xs font-medium ${isBalanced ? 'text-[var(--success)]' : 'text-[var(--danger)]'}`}>
              {isBalanced ? t('lancamentos_balanced') : `${t('lancamentos_difference')} ${fmt(Math.abs(debitTotal - creditTotal))}`}
            </span>
          </div>
        </div>

        {error && <p className="text-xs text-[var(--danger)]">{error}</p>}

        <div className="flex justify-end gap-2 pt-2 border-t border-[var(--bg-border)]">
          <Button type="button" variant="ghost" onClick={onClose}>{t('lancamentos_cancel')}</Button>
          <Button onClick={handleSubmit} loading={submitting} disabled={!isBalanced}>{t('lancamentos_register')}</Button>
        </div>
      </div>
    </Modal>
  )
}
