import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Search, BookOpen, Download } from 'lucide-react'
import { Badge, Button, Card, Input, Select, Table, DateRangePicker } from '@syncero/ui'
import { getTransactions } from '@/lib/backend'
import { TransactionDetailModal } from '@/components/accountant/TransactionDetailModal'
import { ClassifyModal } from '@/components/accountant/ClassifyModal'
import { ExportModal } from '@/components/accountant/ExportModal'
import { usePreferencesStore } from '@/store/preferences'
import { useT } from '@/i18n'
import type { Transaction, TransactionType } from '@/types'

interface TransactionFilters {
  type?: TransactionType
  is_paid?: boolean
  date_from?: string
  date_to?: string
  search?: string
}

type TxRow = Transaction & { is_classified: boolean; journal_entry_id: string | null }

export function Component() {
  const t = useT()
  const { companyId } = useParams<{ companyId: string }>()
  const { language } = usePreferencesStore()
  const [filters, setFilters] = useState<TransactionFilters>(() => {
    const now = new Date()
    const y = now.getFullYear()
    const m = String(now.getMonth() + 1).padStart(2, '0')
    const last = new Date(y, now.getMonth() + 1, 0).getDate()
    return { date_from: `${y}-${m}-01`, date_to: `${y}-${m}-${String(last).padStart(2, '0')}`, is_paid: true }
  })
  const [page, setPage]             = useState(1)
  const [detailRow, setDetailRow]   = useState<TxRow | null>(null)
  const [classifyTx, setClassifyTx] = useState<TxRow | null>(null)
  const [exportOpen, setExportOpen] = useState(false)

  const { data, isLoading } = useQuery({
    queryKey: ['transactions-books', companyId, filters, page],
    queryFn: () =>
      getTransactions({
        companyId: companyId!,
        type: filters.type,
        is_paid: filters.is_paid === undefined ? undefined : String(filters.is_paid),
        date_from: filters.date_from,
        date_to: filters.date_to,
        search: filters.search,
        page: String(page),
        pageSize: '20',
      }),
    enabled: !!companyId,
    refetchInterval: 5 * 60_000,
    refetchOnWindowFocus: true,
  })

  const rows = (data?.data ?? []) as TxRow[]
  const totalPages = Math.ceil((data?.count ?? 0) / 20)

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold text-[var(--text-primary)]">{t('transactions_title')}</h1>
        </div>
        <Button variant="ghost" size="sm" onClick={() => setExportOpen(true)}>
          <Download className="h-4 w-4" /> {t('export_button')}
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
              onChange={(e) => { setPage(1); setFilters(f => ({ ...f, search: e.target.value || undefined })) }}
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
            onChange={(v) => { setPage(1); setFilters(f => ({ ...f, type: v as TransactionFilters['type'] || undefined })) }}
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
            onChange={(v) => { setPage(1); setFilters(f => ({ ...f, is_paid: v === '' ? undefined : v === 'true' })) }}
            className="w-44"
          />
          <DateRangePicker
            size="sm"
            from={filters.date_from ?? ''}
            to={filters.date_to ?? ''}
            onChange={(from, to) => { setPage(1); setFilters(f => ({ ...f, date_from: from || undefined, date_to: to || undefined })) }}
            language={language}
          />
        </div>
      </Card>

      {/* Table */}
      <Card padding="sm">
        <Table
          loading={isLoading}
          data={rows}
          rowKey={(r) => r.id}
          onRowClick={(r: TxRow) => setDetailRow(r)}
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
              key: 'classified',
              header: '',
              render: (r: TxRow) => r.is_classified
                ? <Badge variant="success">{t('classify_badge_done')}</Badge>
                : <Badge variant="warning">{t('classify_badge_pending')}</Badge>,
            },
            {
              key: 'actions',
              header: '',
              align: 'right',
              render: (r: TxRow) => {
                if (r.is_classified) return null
                if (!r.is_paid) return (
                  <div className="relative group flex justify-end">
                    <span className="p-1.5 text-[var(--text-muted)] opacity-40">
                      <BookOpen className="h-4 w-4" />
                    </span>
                    <span className="pointer-events-none absolute -top-8 right-0 whitespace-nowrap rounded px-2 py-1 text-xs bg-[var(--bg-elevated)] border border-[var(--bg-border)] text-[var(--text-secondary)] opacity-0 group-hover:opacity-100 transition-opacity z-10">
                      {t('classify_awaitingPayment')}
                    </span>
                  </div>
                )
                return (
                  <div className="relative group flex justify-end">
                    <button
                      onClick={(e) => { e.stopPropagation(); setClassifyTx(r) }}
                      className="cursor-pointer p-1.5 rounded hover:bg-[var(--bg-border)] text-[var(--text-muted)] hover:text-[var(--accent)] transition-colors"
                    >
                      <BookOpen className="h-4 w-4" />
                    </button>
                    <span className="pointer-events-none absolute -top-8 right-0 whitespace-nowrap rounded px-2 py-1 text-xs bg-[var(--bg-elevated)] border border-[var(--bg-border)] text-[var(--text-secondary)] opacity-0 group-hover:opacity-100 transition-opacity z-10">
                      {t('classify_action')}
                    </span>
                  </div>
                )
              },
            },
          ]}
        />

        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-[var(--bg-border)]">
            <span className="text-xs text-[var(--text-muted)]">
              {t('transactions_page')} {page} / {totalPages}
            </span>
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" disabled={page === 1} onClick={() => setPage(p => p - 1)}>
                {t('transactions_previous')}
              </Button>
              <Button variant="ghost" size="sm" disabled={page === totalPages} onClick={() => setPage(p => p + 1)}>
                {t('transactions_next')}
              </Button>
            </div>
          </div>
        )}
      </Card>

      <TransactionDetailModal
        transactionId={detailRow?.id ?? null}
        open={!!detailRow}
        onClose={() => setDetailRow(null)}
        isClassified={detailRow?.is_classified}
        onClassify={detailRow && !detailRow.is_classified && detailRow.is_paid
          ? () => { setClassifyTx(detailRow); setDetailRow(null) }
          : undefined
        }
        language={language}
      />

      <ClassifyModal
        transaction={classifyTx}
        open={!!classifyTx}
        onClose={() => setClassifyTx(null)}
        companyId={companyId!}
      />

      <ExportModal
        open={exportOpen}
        onClose={() => setExportOpen(false)}
        filters={filters}
        companyId={companyId!}
      />
    </div>
  )
}
