import { useState, useMemo } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { TrendingUp, TrendingDown, AlertCircle } from 'lucide-react'
import { Badge, Button, Input, Modal, Select } from '@syncero/ui'
import { getAccountPlans, createAccountPlan, createJournalEntry } from '@/lib/backend'
import { useT } from '@/i18n'
import type { AccountPlan, AccountType, Transaction, TransactionNature } from '@/types'

// ── Suggestion engine ─────────────────────────────────────────

interface Suggestion {
  debitType: AccountType
  creditType: AccountType
  natureKey: string
}

const NATURE_SUGGESTIONS: Record<string, Suggestion> = {
  sale_service:         { debitType: 'ativo',             creditType: 'receita',           natureKey: 'nature_sale_service' },
  loan_received:        { debitType: 'ativo',             creditType: 'passivo',           natureKey: 'nature_loan_received' },
  capital_contribution: { debitType: 'ativo',             creditType: 'patrimonio_liquido', natureKey: 'nature_capital_contribution' },
  operational_expense:  { debitType: 'despesa',           creditType: 'ativo',             natureKey: 'nature_operational_expense' },
  asset_purchase:       { debitType: 'ativo',             creditType: 'ativo',             natureKey: 'nature_asset_purchase' },
  debt_payment:         { debitType: 'passivo',           creditType: 'ativo',             natureKey: 'nature_debt_payment' },
  owner_withdrawal:     { debitType: 'patrimonio_liquido', creditType: 'ativo',             natureKey: 'nature_owner_withdrawal' },
}

const TYPE_FALLBACK: Record<string, Suggestion> = {
  income:  { debitType: 'ativo',    creditType: 'receita', natureKey: 'nature_income' },
  expense: { debitType: 'despesa',  creditType: 'ativo',   natureKey: 'nature_expense' },
}

function getSuggestion(nature: TransactionNature | null, type: string): Suggestion {
  if (nature && NATURE_SUGGESTIONS[nature]) return NATURE_SUGGESTIONS[nature]
  return TYPE_FALLBACK[type] ?? TYPE_FALLBACK['expense']
}

const NATURE_FROM_TYPE: Record<AccountType, 'devedora' | 'credora'> = {
  ativo:             'devedora',
  passivo:           'credora',
  patrimonio_liquido: 'credora',
  receita:           'credora',
  despesa:           'devedora',
  custo:             'devedora',
}

// ── Inline account creator ────────────────────────────────────

interface InlineCreateProps {
  accountType: AccountType
  companyId: string
  onCreated: (account: AccountPlan) => void
  onCancel: () => void
}

function InlineCreate({ accountType, companyId, onCreated, onCancel }: InlineCreateProps) {
  const t = useT()
  const [code, setCode] = useState('')
  const [name, setName] = useState('')
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const save = async () => {
    if (!code.trim() || !name.trim()) return
    setSaving(true)
    setErr(null)
    try {
      const account = await createAccountPlan({
        companyId,
        code: code.trim(),
        name: name.trim(),
        account_type: accountType,
        nature: NATURE_FROM_TYPE[accountType],
        is_analytic: true,
        parent_id: null,
      })
      onCreated(account)
    } catch {
      setErr(t('classify_newAccount_error'))
      setSaving(false)
    }
  }

  return (
    <div className="mt-2 rounded-lg border border-[var(--bg-border)] bg-[var(--bg-elevated)] p-3 flex flex-col gap-2">
      <p className="text-xs font-semibold text-[var(--text-secondary)]">{t('classify_newAccount_title')}</p>
      <div className="flex gap-2">
        <Input
          size="sm"
          placeholder={t('classify_newAccount_code')}
          value={code}
          onChange={(e) => setCode(e.target.value)}
          className="w-28"
        />
        <Input
          size="sm"
          placeholder={t('classify_newAccount_name')}
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="flex-1"
        />
      </div>
      {err && <p className="text-xs text-[var(--danger)]">{err}</p>}
      <div className="flex gap-2 justify-end">
        <Button variant="ghost" size="sm" onClick={onCancel} disabled={saving}>
          {t('classify_newAccount_cancel')}
        </Button>
        <Button size="sm" onClick={save} disabled={saving || !code.trim() || !name.trim()}>
          {saving ? t('classify_newAccount_creating') : t('classify_newAccount_save')}
        </Button>
      </div>
    </div>
  )
}

// ── Account picker ────────────────────────────────────────────

interface AccountPickerProps {
  label: string
  accountType: AccountType
  accounts: AccountPlan[]
  value: string
  onChange: (id: string) => void
  companyId: string
  onAccountCreated: (account: AccountPlan) => void
}

function AccountPicker({ label, accountType, accounts, value, onChange, companyId, onAccountCreated }: AccountPickerProps) {
  const t = useT()
  const [creating, setCreating] = useState(false)

  const filtered = accounts.filter(a => a.account_type === accountType && a.is_analytic && a.is_active)

  const typeLabel = t(`accountType_${accountType}` as Parameters<typeof t>[0])

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-1.5">
        <span className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">{label}</span>
        <span className="text-xs text-[var(--accent)] font-medium">({typeLabel})</span>
      </div>

      {filtered.length > 0 ? (
        <Select
          size="sm"
          options={[
            { value: '', label: t('classify_selectAccount') },
            ...filtered.map(a => ({ value: a.id, label: `${a.code} — ${a.name}` })),
          ]}
          value={value}
          onChange={onChange}
        />
      ) : (
        !creating && (
          <div className="flex items-center gap-2 rounded-lg border border-dashed border-[var(--bg-border)] px-3 py-2">
            <AlertCircle className="h-3.5 w-3.5 text-[var(--warning)] shrink-0" />
            <span className="text-xs text-[var(--text-muted)] flex-1">{t('classify_noAccounts')}</span>
          </div>
        )
      )}

      {!creating && (
        <button
          type="button"
          onClick={() => setCreating(true)}
          className="text-left text-xs text-[var(--accent)] hover:underline"
        >
          {t('classify_createAccount')} {typeLabel.toLowerCase()}
        </button>
      )}

      {creating && (
        <InlineCreate
          accountType={accountType}
          companyId={companyId}
          onCreated={(account) => {
            onAccountCreated(account)
            onChange(account.id)
            setCreating(false)
          }}
          onCancel={() => setCreating(false)}
        />
      )}
    </div>
  )
}

// ── Main modal ────────────────────────────────────────────────

interface Props {
  transaction: (Transaction & { is_classified?: boolean }) | null
  open: boolean
  onClose: () => void
  companyId: string
}

export function ClassifyModal({ transaction, open, onClose, companyId }: Props) {
  const t = useT()
  const qc = useQueryClient()

  const [debitId,  setDebitId]  = useState('')
  const [creditId, setCreditId] = useState('')
  const [saving, setSaving]     = useState(false)
  const [error,  setError]      = useState<string | null>(null)

  const { data: rawAccounts = [], refetch: refetchAccounts } = useQuery({
    queryKey: ['account-plans', companyId],
    queryFn: () => getAccountPlans(companyId),
    enabled: open && !!companyId,
    staleTime: 60_000,
  })

  const [localAccounts, setLocalAccounts] = useState<AccountPlan[]>([])
  const accounts = useMemo(
    () => [...rawAccounts, ...localAccounts.filter(la => !rawAccounts.some(ra => ra.id === la.id))],
    [rawAccounts, localAccounts],
  )

  const suggestion = transaction
    ? getSuggestion(transaction.nature, transaction.type)
    : TYPE_FALLBACK['expense']

  const isIncome = transaction?.type === 'income'
  const amount   = transaction?.amount ?? 0

  const canSubmit = debitId && creditId && debitId !== creditId

  const handleClose = () => {
    setDebitId('')
    setCreditId('')
    setError(null)
    setSaving(false)
    setLocalAccounts([])
    onClose()
  }

  const handleAccountCreated = (account: AccountPlan) => {
    setLocalAccounts(prev => [...prev, account])
    refetchAccounts()
  }

  const submit = async () => {
    if (!transaction || !canSubmit) return
    setSaving(true)
    setError(null)
    try {
      await createJournalEntry({
        companyId,
        entry_date: transaction.date,
        description: transaction.description,
        flow_transaction_id: transaction.id,
        lines: [
          { account_plan_id: debitId,  side: 'debit',  amount, memo: transaction.description },
          { account_plan_id: creditId, side: 'credit', amount, memo: transaction.description },
        ],
      })
      qc.invalidateQueries({ queryKey: ['transactions-books', companyId] })
      handleClose()
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : ''
      setError(msg.includes('duplicate') ? t('classify_duplicate') : t('classify_error'))
      setSaving(false)
    }
  }

  const natureLabel = t(suggestion.natureKey as Parameters<typeof t>[0])

  const footer = (
    <div className="flex items-center justify-between">
      <Button variant="ghost" size="sm" onClick={handleClose} disabled={saving}>
        {t('classify_cancel')}
      </Button>
      <Button size="sm" onClick={submit} disabled={!canSubmit || saving}>
        {saving ? '…' : t('classify_confirm')}
      </Button>
    </div>
  )

  return (
    <Modal open={open} onClose={handleClose} title={t('classify_title')} size="md" footer={footer}>
      {transaction && (
        <div className="flex flex-col gap-5">

          {/* Transaction summary */}
          <div className="rounded-xl border border-[var(--bg-border)] bg-[var(--bg-elevated)] p-4 flex flex-col gap-2">
            <div className="flex items-center gap-2">
              {isIncome
                ? <TrendingUp  className="h-4 w-4 text-[var(--success)]" />
                : <TrendingDown className="h-4 w-4 text-[var(--danger)]" />
              }
              <span className={`text-2xl font-bold font-mono ${isIncome ? 'text-[var(--success)]' : 'text-[var(--danger)]'}`}>
                {isIncome ? '+' : '-'}{amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
              </span>
              <Badge variant={isIncome ? 'success' : 'danger'}>
                {isIncome ? t('transactions_income_badge') : t('transactions_expense_badge')}
              </Badge>
            </div>
            <p className="text-sm text-[var(--text-primary)]">{transaction.description}</p>
            <div className="flex items-center gap-2">
              <span className="text-xs text-[var(--text-muted)]">{t('classify_nature')}:</span>
              <span className="text-xs font-medium text-[var(--text-secondary)]">{natureLabel}</span>
            </div>
          </div>

          {/* Debit / Credit pickers */}
          <AccountPicker
            label={t('classify_debit')}
            accountType={suggestion.debitType}
            accounts={accounts}
            value={debitId}
            onChange={setDebitId}
            companyId={companyId}
            onAccountCreated={handleAccountCreated}
          />

          <AccountPicker
            label={t('classify_credit')}
            accountType={suggestion.creditType}
            accounts={accounts}
            value={creditId}
            onChange={setCreditId}
            companyId={companyId}
            onAccountCreated={handleAccountCreated}
          />

          {error && (
            <p className="text-sm text-[var(--danger)] flex items-center gap-1.5">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {error}
            </p>
          )}
        </div>
      )}
    </Modal>
  )
}
