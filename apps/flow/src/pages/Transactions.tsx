import { useEffect, useReducer, useRef } from 'react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Plus, CheckCircle, Search, Download, Upload, ChevronDown } from 'lucide-react'
import { Button, Card, Table, Badge, Input, Select, DateRangePicker, IconButton } from '@syncero/ui'
import { usePreferencesStore } from '@/store/preferences'
import { useAuthStore } from '@/store/auth'
import { useTransactions, useCategories } from '@/modules/transactions/queries'
import { TransactionWizard } from '@/modules/transactions/TransactionWizard'
import { TransactionEditModal } from '@/modules/transactions/TransactionEditModal'
import { TransactionDetailModal } from '@/modules/transactions/TransactionDetailModal'
import { PaymentModal } from '@/modules/transactions/PaymentModal'
import { ExportModal } from '@/modules/transactions/ExportModal'
import { ImportModal } from '@/modules/transactions/ImportModal'
import { useT } from '@/i18n'
import type { Transaction, TransactionType } from '@/types'
import type { TransactionFilters } from '@/modules/transactions/types'
import type { WizardPrefill } from '@/modules/transactions/useTransactionWizard'

// ── Page state ─────────────────────────────────────────────────

function defaultFilters(): TransactionFilters {
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const last = new Date(y, now.getMonth() + 1, 0).getDate()
  return { date_from: `${y}-${m}-01`, date_to: `${y}-${m}-${String(last).padStart(2, '0')}` }
}

type PageState = {
  filters: TransactionFilters
  page: number
  detail: string | null
  payment: { id: string; type: TransactionType } | null
  wizard: boolean
  wizardPrefill: WizardPrefill | null
  editing: Transaction | null
  exportOpen: boolean
  importOpen: boolean
  splitOpen: boolean
}

type Action =
  | { type: 'SET_FILTER'; payload: Partial<TransactionFilters>; resetPage: boolean }
  | { type: 'SET_PAGE'; page: number }
  | { type: 'OPEN_DETAIL'; id: string }
  | { type: 'CLOSE_DETAIL' }
  | { type: 'OPEN_PAYMENT'; target: { id: string; type: TransactionType } }
  | { type: 'CLOSE_PAYMENT' }
  | { type: 'OPEN_WIZARD'; prefill?: WizardPrefill }
  | { type: 'CLOSE_WIZARD' }
  | { type: 'SET_EDITING'; tx: Transaction | null }
  | { type: 'OPEN_EXPORT' }
  | { type: 'CLOSE_EXPORT' }
  | { type: 'OPEN_IMPORT' }
  | { type: 'CLOSE_IMPORT' }
  | { type: 'IMPORT_NFE'; prefill: WizardPrefill }
  | { type: 'TOGGLE_SPLIT' }
  | { type: 'CLOSE_SPLIT' }

const initialState: PageState = {
  filters: defaultFilters(),
  page: 1,
  detail: null,
  payment: null,
  wizard: false,
  wizardPrefill: null,
  editing: null,
  exportOpen: false,
  importOpen: false,
  splitOpen: false,
}

function reducer(state: PageState, action: Action): PageState {
  switch (action.type) {
    case 'SET_FILTER':
      return { ...state, filters: { ...state.filters, ...action.payload }, page: action.resetPage ? 1 : state.page }
    case 'SET_PAGE':
      return { ...state, page: action.page }
    case 'OPEN_DETAIL':
      return { ...state, detail: action.id }
    case 'CLOSE_DETAIL':
      return { ...state, detail: null }
    case 'OPEN_PAYMENT':
      return { ...state, payment: action.target }
    case 'CLOSE_PAYMENT':
      return { ...state, payment: null }
    case 'OPEN_WIZARD':
      return { ...state, wizard: true, wizardPrefill: action.prefill ?? null }
    case 'CLOSE_WIZARD':
      return { ...state, wizard: false, wizardPrefill: null }
    case 'SET_EDITING':
      return { ...state, editing: action.tx }
    case 'OPEN_EXPORT':
      return { ...state, exportOpen: true }
    case 'CLOSE_EXPORT':
      return { ...state, exportOpen: false }
    case 'OPEN_IMPORT':
      return { ...state, importOpen: true }
    case 'CLOSE_IMPORT':
      return { ...state, importOpen: false }
    case 'IMPORT_NFE':
      return { ...state, importOpen: false, wizard: true, wizardPrefill: action.prefill }
    case 'TOGGLE_SPLIT':
      return { ...state, splitOpen: !state.splitOpen }
    case 'CLOSE_SPLIT':
      return { ...state, splitOpen: false }
  }
}

// ── Component ──────────────────────────────────────────────────

export function Component() {
  const t = useT()
  const { language } = usePreferencesStore()
  const activeCompany = useAuthStore((s) => s.activeCompany)
  const canWrite = activeCompany?.role !== 'viewer'
  const [state, dispatch] = useReducer(reducer, initialState)
  const splitRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!state.splitOpen) return
    const handler = (e: MouseEvent) => {
      if (!splitRef.current?.contains(e.target as Node)) dispatch({ type: 'CLOSE_SPLIT' })
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [state.splitOpen])

  const { data, isLoading } = useTransactions(state.filters, state.page)
  const { data: categories = [] } = useCategories()
  const filteredCategories = state.filters.type
    ? categories.filter((c) => c.type === state.filters.type)
    : categories

  const totalPages = Math.ceil((data?.count ?? 0) / 20)

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-[var(--text-primary)]">{t('transactions_title')}</h1>
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={() => dispatch({ type: 'OPEN_EXPORT' })}>
            <Download className="h-4 w-4" /> {t('export_button')}
          </Button>
          {canWrite && (
            <div className="relative" ref={splitRef}>
              <div className="flex rounded-[var(--radius-md)] overflow-hidden shadow-sm">
                <button
                  type="button"
                  onClick={() => dispatch({ type: 'OPEN_WIZARD' })}
                  className="flex items-center gap-1.5 h-8 pl-3 pr-3 bg-[var(--accent)] text-white text-sm font-medium hover:opacity-90 active:opacity-80 transition-opacity cursor-pointer"
                >
                  <Plus className="h-4 w-4 shrink-0" />
                  {t('transactions_new')}
                </button>
                <div className="w-px bg-white/25 shrink-0" />
                <button
                  type="button"
                  onClick={() => dispatch({ type: 'TOGGLE_SPLIT' })}
                  className="flex items-center justify-center w-8 bg-[var(--accent)] text-white hover:opacity-90 active:opacity-80 transition-opacity cursor-pointer"
                  aria-label="Mais opções"
                >
                  <ChevronDown className={`h-3.5 w-3.5 transition-transform duration-150 ${state.splitOpen ? 'rotate-180' : ''}`} />
                </button>
              </div>

              {state.splitOpen && (
                <div className="absolute right-0 top-full mt-1.5 w-52 rounded-[var(--radius-lg)] border border-[var(--bg-border)] bg-[var(--bg-surface)] shadow-lg overflow-hidden z-20">
                  <button
                    type="button"
                    onClick={() => { dispatch({ type: 'CLOSE_SPLIT' }); dispatch({ type: 'OPEN_IMPORT' }) }}
                    className="flex items-center gap-2.5 w-full px-3.5 py-2.5 text-sm text-[var(--text-primary)] hover:bg-[var(--bg-elevated)] transition-colors cursor-pointer"
                  >
                    <Upload className="h-4 w-4 shrink-0 text-[var(--text-muted)]" />
                    <div className="flex flex-col items-start">
                      <span className="font-medium leading-tight">{t('transactions_import')}</span>
                      <span className="text-xs text-[var(--text-muted)] leading-tight">XML (NFe / NFSe) · OFX</span>
                    </div>
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Filters */}
      <Card padding="sm">
        <div className="flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-40">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[var(--text-muted)]" />
            <Input
              size="sm"
              placeholder={t('transactions_searchPlaceholder')}
              value={state.filters.search ?? ''}
              onChange={(e) => dispatch({ type: 'SET_FILTER', payload: { search: e.target.value || undefined }, resetPage: true })}
              className="pl-8"
            />
          </div>
          <Select
            size="sm"
            options={[
              { value: '', label: t('transactions_allTypes') },
              { value: 'income', label: t('transactions_income') },
              { value: 'expense', label: t('transactions_expense') },
            ]}
            value={state.filters.type ?? ''}
            onChange={(v) => dispatch({ type: 'SET_FILTER', payload: { type: v as TransactionFilters['type'] || undefined, category_id: undefined }, resetPage: true })}
            className="w-40"
          />
          <Select
            size="sm"
            options={[
              { value: '', label: t('transactions_allStatus') },
              { value: 'true', label: t('transactions_paid') },
              { value: 'false', label: t('transactions_pending') },
            ]}
            value={state.filters.is_paid === undefined ? '' : String(state.filters.is_paid)}
            onChange={(v) => dispatch({ type: 'SET_FILTER', payload: { is_paid: v === '' ? undefined : v === 'true' }, resetPage: false })}
            className="w-44"
          />
          <Select
            size="sm"
            options={[
              { value: '', label: t('transactions_allCategories') },
              { value: 'none', label: t('transactions_filterNoCategory') },
              ...filteredCategories.map((c) => ({ value: c.id, label: c.name })),
            ]}
            value={state.filters.category_id ?? ''}
            onChange={(v) => dispatch({ type: 'SET_FILTER', payload: { category_id: v || undefined }, resetPage: true })}
            className="w-44"
          />
          <DateRangePicker
            size="sm"
            from={state.filters.date_from ?? ''}
            to={state.filters.date_to ?? ''}
            onChange={(from, to) => dispatch({ type: 'SET_FILTER', payload: { date_from: from || undefined, date_to: to || undefined }, resetPage: true })}
            language={language}
          />
        </div>
      </Card>

      {/* Table */}
      <Card padding="sm">
        <Table
          loading={isLoading}
          data={data?.data ?? []}
          rowKey={(r) => r.id}
          onRowClick={(r) => dispatch({ type: 'OPEN_DETAIL', id: r.id })}
          emptyMessage={t('transactions_empty')}
          columns={[
            {
              key: 'date',
              header: t('transactions_date'),
              render: (r) => format(new Date(r.date + 'T00:00:00'), 'dd/MM/yyyy', { locale: ptBR }),
            },
            { key: 'description', header: t('transactions_description') },
            {
              key: 'type',
              header: t('transactions_type'),
              render: (r) => (
                <Badge variant={r.type === 'income' ? 'success' : 'danger'}>
                  {r.type === 'income' ? t('transactions_income_badge') : t('transactions_expense_badge')}
                </Badge>
              ),
            },
            {
              key: 'amount',
              header: t('transactions_amount'),
              align: 'right',
              render: (r) => (
                <span className={r.type === 'income' ? 'text-[var(--success)] font-mono' : 'text-[var(--danger)] font-mono'}>
                  {r.type === 'income' ? '+' : '-'}{' '}
                  {r.amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </span>
              ),
            },
            {
              key: 'is_paid',
              header: t('transactions_status'),
              render: (r) => (
                <Badge variant={r.is_paid ? 'success' : 'warning'}>
                  {r.is_paid
                    ? (r.type === 'income' ? t('transactions_received') : t('transactions_paid'))
                    : (r.type === 'income' ? t('transactions_toReceive') : t('transactions_pending'))}
                </Badge>
              ),
            },
            ...(canWrite ? [{
              key: 'actions',
              header: '',
              align: 'right' as const,
              render: (r: Transaction) =>
                !r.is_paid ? (
                  <div className="flex justify-end">
                    <IconButton
                      icon={<CheckCircle className="h-4 w-4" />}
                      tooltip={r.type === 'income' ? t('transactions_markAsReceived') : t('transactions_markAsPaid')}
                      variant="success"
                      onClick={(e) => { e.stopPropagation(); dispatch({ type: 'OPEN_PAYMENT', target: { id: r.id, type: r.type } }) }}
                    />
                  </div>
                ) : null,
            }] : []),
          ]}
        />

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-[var(--bg-border)]">
            <span className="text-xs text-[var(--text-muted)]">
              {t('incomeStatement_period')} {state.page} / {totalPages}
            </span>
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" disabled={state.page === 1} onClick={() => dispatch({ type: 'SET_PAGE', page: state.page - 1 })}>
                {t('transactions_previous')}
              </Button>
              <Button variant="ghost" size="sm" disabled={state.page === totalPages} onClick={() => dispatch({ type: 'SET_PAGE', page: state.page + 1 })}>
                {t('transactions_next')}
              </Button>
            </div>
          </div>
        )}
      </Card>

      <PaymentModal
        transactionId={state.payment?.id ?? null}
        transactionType={state.payment?.type}
        open={!!state.payment}
        onClose={() => dispatch({ type: 'CLOSE_PAYMENT' })}
        language={language}
      />

      <TransactionDetailModal
        transactionId={state.detail}
        open={!!state.detail}
        onClose={() => dispatch({ type: 'CLOSE_DETAIL' })}
        onEdit={canWrite ? (tx) => dispatch({ type: 'SET_EDITING', tx }) : undefined}
        language={language}
      />

      <TransactionWizard
        open={state.wizard}
        onClose={() => dispatch({ type: 'CLOSE_WIZARD' })}
        editing={null}
        language={language}
        prefill={state.wizardPrefill ?? undefined}
      />

      <ImportModal
        open={state.importOpen}
        onClose={() => dispatch({ type: 'CLOSE_IMPORT' })}
        onNfePrefill={(p) => dispatch({ type: 'IMPORT_NFE', prefill: p })}
      />

      <TransactionEditModal
        transaction={state.editing}
        open={!!state.editing}
        onClose={() => dispatch({ type: 'SET_EDITING', tx: null })}
        language={language}
      />

      <ExportModal
        open={state.exportOpen}
        onClose={() => dispatch({ type: 'CLOSE_EXPORT' })}
        filters={state.filters}
        companyId={activeCompany?.id ?? ''}
      />
    </div>
  )
}
