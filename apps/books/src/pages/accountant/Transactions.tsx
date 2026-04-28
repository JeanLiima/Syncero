import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { format, parseISO } from 'date-fns'
import { ptBR, enUS } from 'date-fns/locale'
import { Search, TrendingUp, TrendingDown, CheckCircle, Clock, Edit2 } from 'lucide-react'
import { Badge, Button, Card, Input, Modal, Select, Table, DateRangePicker } from '@syncero/ui'
import { getTransactions, getTransactionDetail } from '@/lib/backend'
import { ClassifyModal } from '@/components/accountant/ClassifyModal'
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

// ── Detail Modal ──────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">{title}</p>
      {children}
    </div>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <span className="text-sm text-[var(--text-muted)] shrink-0">{label}</span>
      <span className="text-sm text-[var(--text-primary)] text-right">{children}</span>
    </div>
  )
}

function TimelineEvent({ icon, color, label, date, by, sub }: {
  icon: React.ReactNode; color: string; label: string
  date: string; by?: string | null; sub?: string | null
}) {
  return (
    <div className="flex gap-3">
      <div className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${color}`}>
        {icon}
      </div>
      <div className="flex flex-col gap-0.5 pb-4">
        <p className="text-sm text-[var(--text-primary)]">{label}</p>
        <p className="text-xs text-[var(--text-muted)]">{date}{by ? ` · por ${by}` : ''}</p>
        {sub && <p className="text-xs text-[var(--text-muted)] mt-0.5">{sub}</p>}
      </div>
    </div>
  )
}

function TransactionDetailModal({ transactionId, open, onClose, language }: {
  transactionId: string | null; open: boolean; onClose: () => void; language: 'pt' | 'en'
}) {
  const t = useT()
  const locale = language === 'en' ? enUS : ptBR

  const { data: tx, isLoading } = useQuery({
    queryKey: ['transaction', transactionId],
    queryFn: () => getTransactionDetail(transactionId!),
    enabled: !!transactionId && open,
  })

  const fmt = (iso: string, withTime = false) => {
    const d = parseISO(iso)
    return withTime ? format(d, "dd/MM/yyyy 'às' HH:mm", { locale }) : format(d, 'dd/MM/yyyy', { locale })
  }

  const isIncome = tx?.type === 'income'

  const timeline: Array<{ key: string; icon: React.ReactNode; color: string; label: string; date: string; by?: string | null; sub?: string | null }> = []

  if (tx) {
    timeline.push({
      key: 'created',
      icon: <TrendingUp className="h-3 w-3 text-white" />,
      color: 'bg-[var(--accent)]',
      label: t('transactions_detail_histCreated'),
      date: fmt(tx.created_at, true),
      by: tx.creator_name,
    })

    if (new Date(tx.updated_at).getTime() - new Date(tx.created_at).getTime() > 60_000) {
      timeline.push({
        key: 'updated',
        icon: <Edit2 className="h-3 w-3 text-white" />,
        color: 'bg-[var(--text-muted)]',
        label: t('transactions_detail_histUpdated'),
        date: fmt(tx.updated_at, true),
      })
    }

    if (tx.paid_at) {
      timeline.push({
        key: 'paid_at',
        icon: <CheckCircle className="h-3 w-3 text-white" />,
        color: 'bg-[var(--success)]',
        label: isIncome ? t('transactions_detail_histReceivedAt') : t('transactions_detail_histPaidAt'),
        date: fmt(tx.paid_at),
      })
    }

    if (tx.payment_registered_at) {
      const methodLabel = tx.payment_method === 'cash'
        ? t('transactions_detail_cash')
        : tx.payment_method === 'bank'
        ? `${t('transactions_detail_bank')}${tx.banks?.name ? ` · ${tx.banks.name}` : ''}`
        : null

      timeline.push({
        key: 'registered',
        icon: <Clock className="h-3 w-3 text-white" />,
        color: 'bg-[var(--warning)]',
        label: isIncome ? t('transactions_detail_histRegisteredIncome') : t('transactions_detail_histRegistered'),
        date: fmt(tx.payment_registered_at, true),
        by: tx.payment_registrar_name,
        sub: methodLabel,
      })
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={t('transactions_detailTitle')} size="md"
      footer={<Button variant="ghost" size="sm" onClick={onClose}>{t('transactions_close')}</Button>}
    >
      {isLoading && (
        <div className="flex items-center justify-center py-16">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-[var(--accent)] border-t-transparent" />
        </div>
      )}

      {!isLoading && tx && (
        <div className="flex flex-col gap-6">
          <div className="flex flex-col items-center gap-2 py-2">
            <div className="flex items-center gap-2">
              {isIncome ? <TrendingUp className="h-5 w-5 text-[var(--success)]" /> : <TrendingDown className="h-5 w-5 text-[var(--danger)]" />}
              <span className={`text-3xl font-bold font-mono ${isIncome ? 'text-[var(--success)]' : 'text-[var(--danger)]'}`}>
                {isIncome ? '+' : '-'}{tx.amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant={isIncome ? 'success' : 'danger'}>
                {isIncome ? t('transactions_income_badge') : t('transactions_expense_badge')}
              </Badge>
              <Badge variant={tx.is_paid ? 'success' : 'warning'}>
                {tx.is_paid ? (isIncome ? t('transactions_received') : t('transactions_paid')) : (isIncome ? t('transactions_toReceive') : t('transactions_pending'))}
              </Badge>
            </div>
          </div>

          <div className="h-px bg-[var(--bg-border)]" />

          <Section title={t('transactions_detail_sectionDetails')}>
            <Row label={t('transactions_detail_competencyDate')}>{fmt(tx.date + 'T00:00:00')}</Row>
            {tx.categories && (
              <Row label={t('transactions_detail_category')}>
                <span className="flex items-center gap-1.5 justify-end">
                  <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: tx.categories.color ?? '#94a3b8' }} />
                  {tx.categories.name}
                </span>
              </Row>
            )}
            {tx.contacts && (
              <Row label={t('transactions_detail_contact')}>
                <span className="flex flex-col items-end gap-0.5">
                  <span>{tx.contacts.name}</span>
                  {tx.contacts.cpf && <span className="text-xs text-[var(--text-muted)]">CPF {tx.contacts.cpf}</span>}
                  {tx.contacts.cnpj && <span className="text-xs text-[var(--text-muted)]">CNPJ {tx.contacts.cnpj}</span>}
                </span>
              </Row>
            )}
            {tx.description && <Row label={t('transactions_detail_description')}>{tx.description}</Row>}
            {tx.notes && <Row label={t('transactions_detail_notes')}>{tx.notes}</Row>}
            {tx.is_installment && tx.installment_number != null && tx.installment_count != null && (
              <Row label={t('transactions_detail_installment')}>{tx.installment_number}/{tx.installment_count}</Row>
            )}
          </Section>

          <div className="h-px bg-[var(--bg-border)]" />

          <Section title={t('transactions_detail_sectionHistory')}>
            <div className="relative ml-3 border-l border-[var(--bg-border)] pl-4">
              {timeline.map(({ key, ...e }) => <TimelineEvent key={key} {...e} />)}
            </div>
          </Section>
        </div>
      )}
    </Modal>
  )
}

// ── Page ──────────────────────────────────────────────────────

export function Component() {
  const t = useT()
  const { companyId } = useParams<{ companyId: string }>()
  const { language } = usePreferencesStore()

  const [filters, setFilters] = useState<TransactionFilters>({})
  const [page, setPage]       = useState(1)
  const [detailId,  setDetailId]  = useState<string | null>(null)
  const [classifyTx, setClassifyTx] = useState<TxRow | null>(null)

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
  })

  const rows = (data?.data ?? []) as TxRow[]
  const totalPages = Math.ceil((data?.count ?? 0) / 20)

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-[var(--text-primary)]">{t('transactions_title')}</h1>
        <p className="text-sm text-[var(--text-muted)]">
          {data?.count ?? 0} {(data?.count ?? 0) !== 1 ? t('transactions_countPlural') : t('transactions_countSingular')}
        </p>
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
          onRowClick={(r: TxRow) => setDetailId(r.id)}
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
              header: t('classify_title').split(' ')[0],
              render: (r: TxRow) => r.is_classified
                ? <Badge variant="success">{t('classify_badge_done')}</Badge>
                : <Badge variant="warning">{t('classify_badge_pending')}</Badge>,
            },
            {
              key: 'actions',
              header: '',
              align: 'right',
              render: (r: TxRow) =>
                !r.is_classified ? (
                  <button
                    onClick={(e) => { e.stopPropagation(); setClassifyTx(r) }}
                    className="cursor-pointer text-xs font-medium text-[var(--accent)] hover:underline"
                  >
                    {t('classify_action')}
                  </button>
                ) : null,
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
        transactionId={detailId}
        open={!!detailId}
        onClose={() => setDetailId(null)}
        language={language}
      />

      <ClassifyModal
        transaction={classifyTx}
        open={!!classifyTx}
        onClose={() => setClassifyTx(null)}
        companyId={companyId!}
      />
    </div>
  )
}
