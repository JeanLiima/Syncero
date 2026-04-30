import { useState, useMemo, useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { TrendingUp, TrendingDown, AlertCircle, Landmark, Tag, Users, Sparkles } from 'lucide-react'
import { Badge, Button, Input, Modal, Select } from '@syncero/ui'
import { getAccountPlans, createAccountPlan, createJournalEntry } from '@/lib/backend'
import { useT } from '@/i18n'
import type { AccountPlan, AccountType, Transaction, TransactionNature } from '@/types'

// ── Accounting suggestion engine ──────────────────────────────

interface AccountingSuggestion {
  debitType: AccountType
  creditType: AccountType
  natureKey: string
}

const NATURE_SUGGESTIONS: Record<string, AccountingSuggestion> = {
  sale_service:         { debitType: 'asset',   creditType: 'revenue', natureKey: 'nature_sale_service' },
  loan_received:        { debitType: 'asset',   creditType: 'liability', natureKey: 'nature_loan_received' },
  capital_contribution: { debitType: 'asset',   creditType: 'equity',  natureKey: 'nature_capital_contribution' },
  operational_expense:  { debitType: 'expense', creditType: 'asset',   natureKey: 'nature_operational_expense' },
  product_cost:         { debitType: 'cost',    creditType: 'asset',   natureKey: 'nature_product_cost' },
  asset_purchase:       { debitType: 'asset',   creditType: 'asset',   natureKey: 'nature_asset_purchase' },
  debt_payment:         { debitType: 'liability',creditType: 'asset',  natureKey: 'nature_debt_payment' },
  owner_withdrawal:     { debitType: 'equity',  creditType: 'asset',   natureKey: 'nature_owner_withdrawal' },
}

const TYPE_FALLBACK: Record<string, AccountingSuggestion> = {
  income:  { debitType: 'asset',   creditType: 'revenue', natureKey: 'nature_income' },
  expense: { debitType: 'expense', creditType: 'asset',   natureKey: 'nature_expense' },
}

function getSuggestion(nature: TransactionNature | null, type: string): AccountingSuggestion {
  if (nature && NATURE_SUGGESTIONS[nature]) return NATURE_SUGGESTIONS[nature]
  return TYPE_FALLBACK[type] ?? TYPE_FALLBACK['expense']
}

const NATURE_FROM_TYPE: Record<AccountType, 'debit' | 'credit'> = {
  asset:    'debit',
  liability:'credit',
  equity:   'credit',
  revenue:  'credit',
  expense:  'debit',
  cost:     'debit',
}

// ── Smart hints ───────────────────────────────────────────────

type HintSide = 'debit' | 'credit'

interface SmartHint {
  id: string
  Icon: React.ElementType
  label: string
  sub: string
  side: HintSide
  action: 'select' | 'create'
  accountId?: string
  createPreset?: { account_type: AccountType; name: string }
}

function normName(s: string) { return s.toLowerCase().trim() }

function buildHints(
  tx: Transaction,
  accounts: AccountPlan[],
  suggestion: AccountingSuggestion,
): SmartHint[] {
  const hints: SmartHint[] = []
  const analytic = accounts.filter(a => a.is_analytic && a.is_active)
  const isIncome = tx.type === 'income'
  const bankSide: HintSide = isIncome ? 'debit' : 'credit'

  // 1 — Bank
  if (tx.payment_method === 'bank' && tx.banks?.name) {
    const bankName = tx.banks.name
    const match = analytic.find(a =>
      a.account_type === 'asset' && normName(a.name).includes(normName(bankName))
    )
    if (match) {
      hints.push({
        id: 'bank-select',
        Icon: Landmark,
        label: match.name,
        sub: `Conta bancária identificada para ${bankName}`,
        side: bankSide,
        action: 'select',
        accountId: match.id,
      })
    } else {
      hints.push({
        id: 'bank-create',
        Icon: Landmark,
        label: `Criar conta para ${bankName}`,
        sub: `Banco "${bankName}" ainda não tem conta no plano`,
        side: bankSide,
        action: 'create',
        createPreset: { account_type: 'asset', name: bankName },
      })
    }
  }

  // 2 — Category
  if (tx.categories?.name) {
    const catName = tx.categories.name
    const targetType = isIncome ? suggestion.creditType : suggestion.debitType
    const catSide: HintSide = isIncome ? 'credit' : 'debit'
    const match = analytic.find(a =>
      a.account_type === targetType && normName(a.name).includes(normName(catName))
    )
    if (match) {
      hints.push({
        id: 'category-select',
        Icon: Tag,
        label: match.name,
        sub: `Conta sugerida pela categoria "${catName}"`,
        side: catSide,
        action: 'select',
        accountId: match.id,
      })
    }
  }

  // 3 — Contact
  if (tx.contacts?.name) {
    const contactName = tx.contacts.name
    // income → Clientes a receber (asset);  expense → Fornecedores a pagar (liability)
    const targetType: AccountType = isIncome ? 'asset' : 'liability'
    const contactSide: HintSide   = isIncome ? 'debit' : 'credit'
    const keywords = isIncome ? ['cliente', 'receber'] : ['fornecedor', 'pagar']
    const match = analytic.find(a =>
      a.account_type === targetType &&
      keywords.some(k => normName(a.name).includes(k))
    )
    if (match) {
      hints.push({
        id: 'contact-select',
        Icon: Users,
        label: match.name,
        sub: isIncome
          ? `Conta de clientes para "${contactName}"`
          : `Conta de fornecedores para "${contactName}"`,
        side: contactSide,
        action: 'select',
        accountId: match.id,
      })
    }
  }

  return hints
}

// ── Inline account creator ────────────────────────────────────

interface InlineCreateProps {
  accountType: AccountType
  companyId: string
  presetName?: string
  onCreated: (account: AccountPlan) => void
  onCancel: () => void
}

function InlineCreate({ accountType, companyId, presetName, onCreated, onCancel }: InlineCreateProps) {
  const t = useT()
  const [code, setCode]   = useState('')
  const [name, setName]   = useState(presetName ?? '')
  const [saving, setSaving] = useState(false)
  const [err, setErr]       = useState<string | null>(null)

  const save = async () => {
    if (!code.trim() || !name.trim()) return
    setSaving(true); setErr(null)
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
        <Input size="sm" placeholder={t('classify_newAccount_code')} value={code} onChange={e => setCode(e.target.value)} className="w-28" />
        <Input size="sm" placeholder={t('classify_newAccount_name')} value={name} onChange={e => setName(e.target.value)} className="flex-1" />
      </div>
      {err && <p className="text-xs text-[var(--danger)]">{err}</p>}
      <div className="flex gap-2 justify-end">
        <Button variant="ghost" size="sm" onClick={onCancel} disabled={saving}>{t('classify_newAccount_cancel')}</Button>
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
  createPreset?: string
}

function AccountPicker({ label, accountType, accounts, value, onChange, companyId, onAccountCreated, createPreset }: AccountPickerProps) {
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
          searchable
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
        <button type="button" onClick={() => setCreating(true)} className="cursor-pointer text-left text-xs text-[var(--accent)] hover:underline">
          {t('classify_createAccount')} {typeLabel.toLowerCase()}
        </button>
      )}

      {creating && (
        <InlineCreate
          accountType={accountType}
          companyId={companyId}
          presetName={createPreset}
          onCreated={account => { onAccountCreated(account); onChange(account.id); setCreating(false) }}
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
  const [saving,   setSaving]   = useState(false)
  const [error,    setError]    = useState<string | null>(null)

  // Presets from hints that want to open the inline creator
  const [debitCreatePreset,  setDebitCreatePreset]  = useState<string | undefined>()
  const [creditCreatePreset, setCreditCreatePreset] = useState<string | undefined>()

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

  const hints = useMemo(
    () => transaction ? buildHints(transaction, accounts, suggestion) : [],
    [transaction, accounts, suggestion],
  )

  // Auto-apply best account for each side when accounts load
  useEffect(() => {
    if (!transaction || rawAccounts.length === 0) return
    const analytic = rawAccounts.filter(a => a.is_analytic && a.is_active)

    const autoSelect = (side: 'debit' | 'credit', type: AccountType): string => {
      // 1. matching hint
      const hint = hints.find(h => h.side === side && h.action === 'select' && h.accountId)
      if (hint?.accountId) return hint.accountId
      // 2. first analytic of suggested type
      return analytic.find(a => a.account_type === type)?.id ?? ''
    }

    setDebitId(prev  => prev || autoSelect('debit',  suggestion.debitType))
    setCreditId(prev => prev || autoSelect('credit', suggestion.creditType))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rawAccounts, transaction])

  const isIncome  = transaction?.type === 'income'
  const amount    = transaction?.amount ?? 0
  const canSubmit = debitId && creditId && debitId !== creditId

  const handleClose = () => {
    setDebitId(''); setCreditId('')
    setDebitCreatePreset(undefined); setCreditCreatePreset(undefined)
    setError(null); setSaving(false); setLocalAccounts([])
    onClose()
  }

  const handleAccountCreated = (account: AccountPlan) => {
    setLocalAccounts(prev => [...prev, account])
    refetchAccounts()
  }

  const applyHint = async (hint: SmartHint) => {
    if (hint.action === 'select' && hint.accountId) {
      if (hint.side === 'debit')  setDebitId(hint.accountId)
      else                        setCreditId(hint.accountId)
    } else if (hint.action === 'create' && hint.createPreset) {
      // Signal the relevant AccountPicker to open its inline creator
      if (hint.side === 'debit')  setDebitCreatePreset(hint.createPreset.name)
      else                        setCreditCreatePreset(hint.createPreset.name)
    }
  }

  const submit = async () => {
    if (!transaction || !canSubmit) return
    setSaving(true); setError(null)
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

          {/* Smart hints */}
          {hints.length > 0 && (
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5 text-[var(--accent)]" />
                <span className="text-xs font-semibold text-[var(--text-secondary)]">{t('classify_hints')}</span>
              </div>
              {hints.map(hint => {
                const applied = hint.side === 'debit'
                  ? debitId === hint.accountId
                  : creditId === hint.accountId
                return (
                  <button
                    key={hint.id}
                    type="button"
                    onClick={() => applyHint(hint)}
                    disabled={applied}
                    className={`flex items-start gap-3 rounded-lg border px-3 py-2 text-left transition-colors cursor-pointer ${
                      applied
                        ? 'border-[var(--accent)]/40 bg-[var(--accent)]/8 cursor-default'
                        : 'border-[var(--bg-border)] hover:border-[var(--accent)]/40 hover:bg-[var(--accent)]/5'
                    }`}
                  >
                    <hint.Icon className={`h-4 w-4 shrink-0 mt-0.5 ${applied ? 'text-[var(--accent)]' : 'text-[var(--text-muted)]'}`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium text-[var(--text-primary)] truncate">{hint.label}</span>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded shrink-0 ${
                          hint.side === 'debit'
                            ? 'bg-blue-500/15 text-blue-400'
                            : 'bg-green-500/15 text-green-400'
                        }`}>
                          {hint.side === 'debit' ? t('classify_debit') : t('classify_credit')}
                        </span>
                        {hint.action === 'create' && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--warning)]/15 text-[var(--warning)] shrink-0">
                            {t('classify_hintNew')}
                          </span>
                        )}
                        {applied && (
                          <span className="text-[10px] text-[var(--accent)] shrink-0">{t('classify_hintApplied')}</span>
                        )}
                      </div>
                      <p className="text-[11px] text-[var(--text-muted)] mt-0.5">{hint.sub}</p>
                    </div>
                  </button>
                )
              })}
            </div>
          )}

          {/* Debit / Credit pickers */}
          <AccountPicker
            label={isIncome ? t('classify_debit_income') : t('classify_debit_expense')}
            accountType={suggestion.debitType}
            accounts={accounts}
            value={debitId}
            onChange={setDebitId}
            companyId={companyId}
            onAccountCreated={handleAccountCreated}
            createPreset={debitCreatePreset}
          />

          <AccountPicker
            label={isIncome ? t('classify_credit_income') : t('classify_credit_expense')}
            accountType={suggestion.creditType}
            accounts={accounts}
            value={creditId}
            onChange={setCreditId}
            companyId={companyId}
            onAccountCreated={handleAccountCreated}
            createPreset={creditCreatePreset}
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
