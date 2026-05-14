import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { format } from 'date-fns'
import { ptBR, enUS } from 'date-fns/locale'
import { FileText } from 'lucide-react'
import { Card, Table, Badge, Select, DateRangePicker } from '@syncero/ui'
import { getFiscalDocuments } from '@/lib/backend'
import { useCompanyContext } from '@/hooks/useCompanyContext'
import { usePreferencesStore } from '@/store/preferences'
import { useT } from '@/i18n'
import type { FiscalDocument, FiscalDocType } from '@/types'

type Direction = '' | 'income' | 'expense'
type DocStatus = '' | 'authorized' | 'cancelled' | 'denied'

const DOC_TYPE_LABELS: Record<string, string> = {
  nfe: 'NF-e', nfse: 'NFS-e', cfe: 'CF-e', nfce: 'NFC-e', cte: 'CT-e',
}

const PAGE_SIZE = 20

export function Component() {
  const t       = useT()
  const { companyId, extCompanyId } = useCompanyContext()
  const { language } = usePreferencesStore()
  const locale = language === 'pt' ? ptBR : enUS

  const [filterType,  setFilterType]  = useState<FiscalDocType | ''>('')
  const [direction,   setDirection]   = useState<Direction>('')
  const [docStatus,   setDocStatus]   = useState<DocStatus>('')
  const [dateFrom,    setDateFrom]    = useState('')
  const [dateTo,      setDateTo]      = useState('')
  const [page,        setPage]        = useState(1)

  const { data, isLoading } = useQuery({
    queryKey: ['fiscal-docs', companyId, extCompanyId, filterType, direction, docStatus, dateFrom, dateTo, page],
    queryFn: () => getFiscalDocuments({
      companyId:    companyId    || undefined,
      extCompanyId: extCompanyId || undefined,
      doc_type:     filterType   || undefined,
      direction:    direction    || undefined,
      pending:      undefined,
      date_from:    dateFrom     || undefined,
      date_to:      dateTo       || undefined,
      page:         String(page),
      page_size:    String(PAGE_SIZE),
    }),
    enabled: !!(companyId || extCompanyId),
  })

  const docs  = data?.data  ?? []
  const total = data?.count ?? 0
  const pages = Math.ceil(total / PAGE_SIZE)

  const statusVariant = (s: FiscalDocument['doc_status']) =>
    s === 'authorized' ? 'success' : s === 'cancelled' ? 'danger' : 'warning'

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-semibold text-[var(--text-primary)]">{t('nfe_title')}</h1>

      {/* Filtros */}
      <Card padding="sm">
        <div className="flex flex-wrap gap-3">
          <Select
            size="sm"
            options={[
              { value: '',      label: t('nfe_allTypes') },
              { value: 'nfe',   label: 'NF-e' },
              { value: 'nfse',  label: 'NFS-e' },
              { value: 'cte',   label: 'CT-e' },
              { value: 'cfe',   label: 'CF-e' },
              { value: 'nfce',  label: 'NFC-e' },
            ]}
            value={filterType}
            onChange={(v) => { setFilterType(v as FiscalDocType | ''); setPage(1) }}
            className="w-36"
          />
          <Select
            size="sm"
            options={[
              { value: '',        label: t('nfe_allDirections') },
              { value: 'income',  label: t('nfe_income') },
              { value: 'expense', label: t('nfe_expense') },
            ]}
            value={direction}
            onChange={(v) => { setDirection(v as Direction); setPage(1) }}
            className="w-36"
          />
          <Select
            size="sm"
            options={[
              { value: '',           label: t('nfe_allStatus') },
              { value: 'authorized', label: t('nfe_authorized') },
              { value: 'cancelled',  label: t('nfe_cancelled') },
              { value: 'denied',     label: t('nfe_denied') },
            ]}
            value={docStatus}
            onChange={(v) => { setDocStatus(v as DocStatus); setPage(1) }}
            className="w-36"
          />
          <DateRangePicker
            size="sm"
            from={dateFrom}
            to={dateTo}
            language={language}
            onChange={(f, t2) => { setDateFrom(f); setDateTo(t2); setPage(1) }}
            className="w-64"
          />
        </div>
      </Card>

      {/* Tabela */}
      <Card padding="sm">
        {!isLoading && docs.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
            <FileText className="h-8 w-8 text-[var(--text-muted)]" />
            <p className="text-sm font-medium text-[var(--text-primary)]">{t('nfe_empty')}</p>
            <p className="text-xs text-[var(--text-muted)] max-w-xs">{t('nfe_emptyHint')}</p>
          </div>
        ) : (
          <Table
            loading={isLoading}
            data={docs}
            rowKey={(r) => r.id}
            emptyMessage={t('nfe_empty')}
            columns={[
              {
                key: 'issue_date',
                header: t('nfe_issueDate'),
                render: (r) => format(new Date(r.issue_date + 'T00:00:00'), 'dd/MM/yyyy', { locale }),
              },
              {
                key: 'doc_type',
                header: t('nfe_type'),
                render: (r) => (
                  <div className="flex items-center gap-1.5">
                    <Badge variant={r.doc_direction === 'income' ? 'success' : r.doc_direction === 'expense' ? 'danger' : 'default'}>
                      {DOC_TYPE_LABELS[r.doc_type] ?? r.doc_type.toUpperCase()}
                    </Badge>
                  </div>
                ),
              },
              { key: 'doc_number', header: t('nfe_number'), render: (r) => r.doc_number ?? '—' },
              {
                key: 'counterpart',
                header: t('nfe_counterpart'),
                render: (r) => r.counterpart ?? r.issuer_name ?? '—',
              },
              {
                key: 'amount',
                header: t('nfe_value'),
                align: 'right',
                render: (r) => r.amount != null
                  ? <span className="font-mono">{r.amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                  : '—',
              },
              {
                key: 'doc_status',
                header: t('nfe_status'),
                render: (r) => (
                  <Badge variant={statusVariant(r.doc_status)}>
                    {r.doc_status === 'authorized' ? t('nfe_authorized')
                      : r.doc_status === 'cancelled' ? t('nfe_cancelled')
                      : t('nfe_denied')}
                  </Badge>
                ),
              },
            ]}
          />
        )}
      </Card>

      {/* Paginação */}
      {pages > 1 && (
        <div className="flex items-center justify-center gap-4 text-sm text-[var(--text-muted)]">
          <button
            onClick={() => setPage((p) => p - 1)}
            disabled={page <= 1}
            className="px-3 py-1.5 rounded-[var(--radius-md)] border border-[var(--bg-border)] disabled:opacity-40 hover:bg-[var(--bg-elevated)] transition-colors cursor-pointer disabled:cursor-not-allowed"
          >
            ‹
          </button>
          <span>{page} / {pages}</span>
          <button
            onClick={() => setPage((p) => p + 1)}
            disabled={page >= pages}
            className="px-3 py-1.5 rounded-[var(--radius-md)] border border-[var(--bg-border)] disabled:opacity-40 hover:bg-[var(--bg-elevated)] transition-colors cursor-pointer disabled:cursor-not-allowed"
          >
            ›
          </button>
        </div>
      )}
    </div>
  )
}
