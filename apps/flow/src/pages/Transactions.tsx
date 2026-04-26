import { useState } from 'react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Plus, CheckCircle, Search } from 'lucide-react'
import { Button, Card, Table, Badge, Input, Select, DateRangePicker } from '@syncero/ui'
import { usePreferencesStore } from '@/store/preferences'
import { useTransactions } from '@/modules/transactions/queries'
import { useMarkAsPaid } from '@/modules/transactions/mutations'
import { TransactionWizard } from '@/modules/transactions/TransactionWizard'
import { useT } from '@/i18n'
import type { Transaction } from '@/types'
import type { TransactionFilters } from '@/modules/transactions/types'

export function Component() {
  const t = useT()
  const { language } = usePreferencesStore()

  const [filters, setFilters] = useState<TransactionFilters>({})
  const [page, setPage] = useState(1)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Transaction | null>(null)

  const { data, isLoading } = useTransactions(filters, page)
  const markPaid = useMarkAsPaid()

  const openCreate = () => {
    setEditing(null)
    setModalOpen(true)
  }

  const openEdit = (row: Transaction) => {
    setEditing(row)
    setModalOpen(true)
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
        <Button size="sm" onClick={openCreate}>
          <Plus className="h-4 w-4" /> {t('transactions_new')}
        </Button>
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
            onChange={(v) => setFilters((f) => ({ ...f, type: v as TransactionFilters['type'] || undefined }))}
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
          onRowClick={openEdit}
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
                  {r.is_paid ? t('transactions_paid') : t('transactions_pending')}
                </Badge>
              ),
            },
            {
              key: 'actions',
              header: '',
              align: 'right',
              render: (r) =>
                !r.is_paid ? (
                  <button
                    onClick={(e) => { e.stopPropagation(); markPaid.mutate(r.id) }}
                    className="p-1 text-[var(--text-muted)] hover:text-[var(--success)] transition-colors cursor-pointer"
                    title={t('transactions_markAsPaid')}
                  >
                    <CheckCircle className="h-4 w-4" />
                  </button>
                ) : null,
            },
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

      <TransactionWizard
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        editing={editing}
        language={language}
      />
    </div>
  )
}
