import { useState } from 'react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Plus, CheckCircle, Search, Download } from 'lucide-react'
import { Button, Card, Table, Badge, Input, Select, DateRangePicker } from '@syncero/ui'
import { usePreferencesStore } from '@/store/preferences'
import { useAuthStore } from '@/store/auth'
import { useTransactions, useCategories } from '@/modules/transactions/queries'
import { TransactionWizard } from '@/modules/transactions/TransactionWizard'
import { TransactionEditModal } from '@/modules/transactions/TransactionEditModal'
import { TransactionDetailModal } from '@/modules/transactions/TransactionDetailModal'
import { PaymentModal } from '@/modules/transactions/PaymentModal'
import { ExportModal } from '@/modules/transactions/ExportModal'
import { useT } from '@/i18n'
import type { Transaction, TransactionType } from '@/types'
import type { TransactionFilters } from '@/modules/transactions/types'

export function Component() {
  const t = useT()
  const { language } = usePreferencesStore()
  const activeCompany = useAuthStore((s) => s.activeCompany)
  const canWrite = activeCompany?.role !== 'viewer'

  const [filters, setFilters] = useState<TransactionFilters>(() => {
    const now = new Date()
    const y = now.getFullYear()
    const m = String(now.getMonth() + 1).padStart(2, '0')
    const last = new Date(y, now.getMonth() + 1, 0).getDate()
    return { date_from: `${y}-${m}-01`, date_to: `${y}-${m}-${String(last).padStart(2, '0')}` }
  })
  const [page, setPage] = useState(1)
  const [detailId, setDetailId] = useState<string | null>(null)
  const [paymentTarget, setPaymentTarget] = useState<{ id: string; type: TransactionType } | null>(null)
  const [wizardOpen, setWizardOpen] = useState(false)
  const [editing, setEditing] = useState<Transaction | null>(null)
  const [exportOpen, setExportOpen] = useState(false)

  const { data, isLoading } = useTransactions(filters, page)
  const { data: categories = [] } = useCategories()
  const filteredCategories = filters.type
    ? categories.filter((c) => c.type === filters.type)
    : categories

  const openCreate = () => {
    setEditing(null)
    setWizardOpen(true)
  }

  const openDetail = (row: Transaction) => setDetailId(row.id)

  const openEdit = (tx: Transaction) => {
    setEditing(tx)
  }

  const totalPages = Math.ceil((data?.count ?? 0) / 20)

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-[var(--text-primary)]">{t('transactions_title')}</h1>
          <p className="text-sm text-[var(--text-muted)]">
            {data?.count ?? 0} {(data?.count ?? 0) !== 1 ? t('transactions_countPlural') : t('transactions_countSingular')}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={() => setExportOpen(true)}>
            <Download className="h-4 w-4" /> {t('export_button')}
          </Button>
          {canWrite && (
            <Button size="sm" onClick={openCreate}>
              <Plus className="h-4 w-4" /> {t('transactions_new')}
            </Button>
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
              value={filters.search ?? ''}
              onChange={(e) => { setPage(1); setFilters((f) => ({ ...f, search: e.target.value || undefined })) }}
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
            value={filters.type ?? ''}
            onChange={(v) => { setPage(1); setFilters((f) => ({ ...f, type: v as TransactionFilters['type'] || undefined, category_id: undefined })) }}
            className="w-40"
          />
          <Select
            size="sm"
            options={[
              { value: '', label: t('transactions_allStatus') },
              { value: 'true', label: t('transactions_paid') },
              { value: 'false', label: t('transactions_pending') },
            ]}
            value={filters.is_paid === undefined ? '' : String(filters.is_paid)}
            onChange={(v) => setFilters((f) => ({ ...f, is_paid: v === '' ? undefined : v === 'true' }))}
            className="w-44"
          />
          <Select
            size="sm"
            options={[
              { value: '', label: t('transactions_allCategories') },
              { value: 'none', label: t('transactions_filterNoCategory') },
              ...filteredCategories.map((c) => ({ value: c.id, label: c.name })),
            ]}
            value={filters.category_id ?? ''}
            onChange={(v) => { setPage(1); setFilters((f) => ({ ...f, category_id: v || undefined })) }}
            className="w-44"
          />
          <DateRangePicker
            size="sm"
            from={filters.date_from ?? ''}
            to={filters.date_to ?? ''}
            onChange={(from, to) => { setPage(1); setFilters((f) => ({ ...f, date_from: from || undefined, date_to: to || undefined })) }}
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
          onRowClick={openDetail}
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
                  <div className="relative group flex justify-end">
                    <button
                      onClick={(e) => { e.stopPropagation(); setPaymentTarget({ id: r.id, type: r.type }) }}
                      className="cursor-pointer p-1.5 rounded hover:bg-[var(--bg-border)] text-[var(--text-muted)] hover:text-[var(--success)] transition-colors"
                    >
                      <CheckCircle className="h-4 w-4" />
                    </button>
                    <span className="pointer-events-none absolute -top-8 right-0 whitespace-nowrap rounded px-2 py-1 text-xs bg-[var(--bg-elevated)] border border-[var(--bg-border)] text-[var(--text-secondary)] opacity-0 group-hover:opacity-100 transition-opacity z-10">
                      {r.type === 'income' ? t('transactions_markAsReceived') : t('transactions_markAsPaid')}
                    </span>
                  </div>
                ) : null,
            }] : []),
          ]}
        />

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-[var(--bg-border)]">
            <span className="text-xs text-[var(--text-muted)]">
              {t('incomeStatement_period')} {page} / {totalPages}
            </span>
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" disabled={page === 1} onClick={() => setPage((p) => p - 1)}>
                {t('transactions_previous')}
              </Button>
              <Button variant="ghost" size="sm" disabled={page === totalPages} onClick={() => setPage((p) => p + 1)}>
                {t('transactions_next')}
              </Button>
            </div>
          </div>
        )}
      </Card>

      <PaymentModal
        transactionId={paymentTarget?.id ?? null}
        transactionType={paymentTarget?.type}
        open={!!paymentTarget}
        onClose={() => setPaymentTarget(null)}
        language={language}
      />

      <TransactionDetailModal
        transactionId={detailId}
        open={!!detailId}
        onClose={() => setDetailId(null)}
        onEdit={canWrite ? openEdit : undefined}
        language={language}
      />

      <TransactionWizard
        open={wizardOpen}
        onClose={() => setWizardOpen(false)}
        editing={null}
        language={language}
      />

      <TransactionEditModal
        transaction={editing}
        open={!!editing}
        onClose={() => setEditing(null)}
        language={language}
      />

      <ExportModal
        open={exportOpen}
        onClose={() => setExportOpen(false)}
        filters={filters}
        companyId={activeCompany?.id ?? ''}
      />
    </div>
  )
}
