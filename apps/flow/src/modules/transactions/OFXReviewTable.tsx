import { useState } from 'react'
import { Button, Select } from '@syncero/ui'
import { TrendingDown, TrendingUp } from 'lucide-react'
import { format, parse, isValid } from 'date-fns'
import { useT } from '@/i18n'
import { useCategories } from './queries'
import { useCreateTransaction } from './mutations'
import type { OFXTransaction } from '@/lib/parsers/ofx'
import type { TransactionNature } from '@/types'

const NATURE_OPTIONS_INCOME: { value: TransactionNature; labelKey: string }[] = [
  { value: 'sale_service',         labelKey: 'transactions_nature_sale_service' },
  { value: 'loan_received',        labelKey: 'transactions_nature_loan_received' },
  { value: 'capital_contribution', labelKey: 'transactions_nature_capital_contribution' },
]

const NATURE_OPTIONS_EXPENSE: { value: TransactionNature; labelKey: string }[] = [
  { value: 'operational_expense', labelKey: 'transactions_nature_operational_expense' },
  { value: 'product_cost',        labelKey: 'transactions_nature_product_cost' },
  { value: 'asset_purchase',      labelKey: 'transactions_nature_asset_purchase' },
  { value: 'debt_payment',        labelKey: 'transactions_nature_debt_payment' },
  { value: 'owner_withdrawal',    labelKey: 'transactions_nature_owner_withdrawal' },
]

interface RowState {
  selected: boolean
  nature: TransactionNature
  categoryId: string | undefined
}

interface Props {
  transactions: OFXTransaction[]
  onConfirm: () => void
  onCancel: () => void
}

function fmtDate(iso: string) {
  const d = parse(iso, 'yyyy-MM-dd', new Date())
  return isValid(d) ? format(d, 'dd/MM/yy') : iso
}

function fmtAmount(cents: number) {
  return (cents / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export function OFXReviewTable({ transactions, onConfirm, onCancel }: Props) {
  const t = useT()
  const { data: categories = [] } = useCategories()
  const create = useCreateTransaction()

  const [rows, setRows] = useState<RowState[]>(() =>
    transactions.map((tx) => ({
      selected: true,
      nature: tx.type === 'income' ? 'sale_service' : 'operational_expense',
      categoryId: undefined,
    }))
  )
  const [globalNatureIncome, setGlobalNatureIncome] = useState<TransactionNature>('sale_service')
  const [globalNatureExpense, setGlobalNatureExpense] = useState<TransactionNature>('operational_expense')
  const [globalCategory, setGlobalCategory] = useState<string>('')

  const applyGlobalNature = (type: 'income' | 'expense', nature: TransactionNature) => {
    setRows((prev) =>
      prev.map((r, i) =>
        transactions[i].type === type && r.selected ? { ...r, nature } : r
      )
    )
  }

  const applyGlobalCategory = (catId: string) => {
    setRows((prev) => prev.map((r) => r.selected ? { ...r, categoryId: catId || undefined } : r))
  }

  const updateRow = (i: number, patch: Partial<RowState>) => {
    setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, ...patch } : r)))
  }

  const selectedCount = rows.filter((r) => r.selected).length

  const handleConfirm = async () => {
    for (let i = 0; i < transactions.length; i++) {
      if (!rows[i].selected) continue
      const tx = transactions[i]
      await create.mutateAsync({
        type: tx.type,
        nature: rows[i].nature,
        amount: tx.amountCents / 100,
        date: tx.date,
        description: tx.description || tx.counterpart,
        counterpart: tx.counterpart,
        category_id: rows[i].categoryId ?? null,
        is_paid: true,
        paid_at: tx.date,
        is_installment: false,
      })
    }
    onConfirm()
  }

  const incomeNatureOptions = NATURE_OPTIONS_INCOME.map((n) => ({ value: n.value, label: t(n.labelKey as Parameters<typeof t>[0]) }))
  const expenseNatureOptions = NATURE_OPTIONS_EXPENSE.map((n) => ({ value: n.value, label: t(n.labelKey as Parameters<typeof t>[0]) }))
  const categoryOptions = [
    { value: '', label: t('transactions_noCategory') },
    ...categories.map((c) => ({ value: c.id, label: c.name })),
  ]

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm font-medium text-[var(--text-primary)]">
        {t('transactions_import_ofx_found').replace('{count}', String(transactions.length))}
      </p>

      {/* Global defaults */}
      <div className="flex flex-wrap gap-3 p-3 rounded-lg bg-[var(--bg-elevated)] border border-[var(--bg-border)]">
        <div className="flex flex-col gap-1 min-w-40 flex-1">
          <span className="text-xs text-[var(--text-muted)]">{t('transactions_import_ofx_defaultNature')} — {t('transactions_income')}</span>
          <Select
            size="sm"
            options={incomeNatureOptions}
            value={globalNatureIncome}
            onChange={(v) => {
              const n = v as TransactionNature
              setGlobalNatureIncome(n)
              applyGlobalNature('income', n)
            }}
          />
        </div>
        <div className="flex flex-col gap-1 min-w-40 flex-1">
          <span className="text-xs text-[var(--text-muted)]">{t('transactions_import_ofx_defaultNature')} — {t('transactions_expense')}</span>
          <Select
            size="sm"
            options={expenseNatureOptions}
            value={globalNatureExpense}
            onChange={(v) => {
              const n = v as TransactionNature
              setGlobalNatureExpense(n)
              applyGlobalNature('expense', n)
            }}
          />
        </div>
        <div className="flex flex-col gap-1 min-w-40 flex-1">
          <span className="text-xs text-[var(--text-muted)]">{t('transactions_import_ofx_defaultCategory')}</span>
          <Select
            size="sm"
            options={categoryOptions}
            value={globalCategory}
            onChange={(v) => {
              setGlobalCategory(v)
              applyGlobalCategory(v)
            }}
          />
        </div>
      </div>

      {/* Transactions table */}
      <div className="rounded-lg border border-[var(--bg-border)] overflow-hidden max-h-72 overflow-y-auto">
        {/* Header */}
        <div className="grid grid-cols-[1.5rem_3.5rem_1.5rem_1fr_5rem_7rem_7rem] gap-2 px-3 py-2 bg-[var(--bg-elevated)] border-b border-[var(--bg-border)]">
          <input
            type="checkbox"
            checked={selectedCount === transactions.length}
            onChange={(e) => setRows((prev) => prev.map((r) => ({ ...r, selected: e.target.checked })))}
            className="h-3.5 w-3.5 accent-[var(--accent)] cursor-pointer"
          />
          <span className="text-xs text-[var(--text-muted)]">{t('transactions_date')}</span>
          <span />
          <span className="text-xs text-[var(--text-muted)]">{t('transactions_description')}</span>
          <span className="text-xs text-[var(--text-muted)] text-right">{t('transactions_amount')}</span>
          <span className="text-xs text-[var(--text-muted)]">{t('transactions_nature')}</span>
          <span className="text-xs text-[var(--text-muted)]">{t('transactions_category')}</span>
        </div>

        {/* Rows */}
        <div className="divide-y divide-[var(--bg-border)]">
          {transactions.map((tx, i) => {
            const row = rows[i]
            const natureOpts = tx.type === 'income' ? incomeNatureOptions : expenseNatureOptions
            const catOpts = [
              { value: '', label: '—' },
              ...categories.filter((c) => c.type === tx.type).map((c) => ({ value: c.id, label: c.name })),
            ]
            return (
              <div
                key={tx.fitId}
                className={`grid grid-cols-[1.5rem_3.5rem_1.5rem_1fr_5rem_7rem_7rem] gap-2 items-center px-3 py-2 transition-colors ${
                  row.selected ? 'bg-[var(--bg-base)]' : 'bg-[var(--bg-elevated)] opacity-50'
                }`}
              >
                <input
                  type="checkbox"
                  checked={row.selected}
                  onChange={(e) => updateRow(i, { selected: e.target.checked })}
                  className="h-3.5 w-3.5 accent-[var(--accent)] cursor-pointer"
                />
                <span className="text-xs text-[var(--text-muted)] font-mono">{fmtDate(tx.date)}</span>
                <span className="flex items-center justify-center">
                  {tx.type === 'income'
                    ? <TrendingUp className="h-3.5 w-3.5 text-[var(--success)]" />
                    : <TrendingDown className="h-3.5 w-3.5 text-[var(--danger)]" />
                  }
                </span>
                <span className="text-xs text-[var(--text-primary)] truncate" title={tx.description}>
                  {tx.description}
                </span>
                <span className={`text-xs font-medium tabular-nums text-right ${
                  tx.type === 'income' ? 'text-[var(--success)]' : 'text-[var(--danger)]'
                }`}>
                  R$ {fmtAmount(tx.amountCents)}
                </span>
                <Select
                  size="sm"
                  options={natureOpts}
                  value={row.nature}
                  onChange={(v) => updateRow(i, { nature: v as TransactionNature })}
                />
                <Select
                  size="sm"
                  options={catOpts}
                  value={row.categoryId ?? ''}
                  onChange={(v) => updateRow(i, { categoryId: v || undefined })}
                />
              </div>
            )
          })}
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between pt-2 border-t border-[var(--bg-border)]">
        <Button variant="ghost" size="sm" onClick={onCancel}>
          {t('transactions_cancel')}
        </Button>
        <Button
          size="sm"
          onClick={handleConfirm}
          loading={create.isPending}
          disabled={selectedCount === 0}
        >
          {selectedCount === 0
            ? t('transactions_import_ofx_noneSelected')
            : t('transactions_import_ofx_confirm').replace('{count}', String(selectedCount))
          }
        </Button>
      </div>
    </div>
  )
}
