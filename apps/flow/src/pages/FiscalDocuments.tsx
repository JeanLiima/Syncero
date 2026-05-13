import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { FileText, ArrowRight, CheckCircle2, ExternalLink } from 'lucide-react'
import { Button, Card, Badge } from '@syncero/ui'
import { useAuthStore } from '@/store/auth'
import { usePreferencesStore } from '@/store/preferences'
import { useT } from '@/i18n'
import { getFiscalDocuments, type FiscalDocument } from '@/lib/backend'
import { TransactionWizard } from '@/modules/transactions/TransactionWizard'
import type { WizardPrefill } from '@/modules/transactions/useTransactionWizard'

type Direction = '' | 'income' | 'expense'

function formatCurrency(v: number | null) {
  if (v === null) return '—'
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function formatDate(iso: string) {
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

const DOC_TYPE_LABELS: Record<string, string> = {
  nfe: 'NF-e', nfse: 'NFS-e', cfe: 'CF-e', cte: 'CT-e',
}

export function Component() {
  const t             = useT()
  const navigate      = useNavigate()
  const { language }  = usePreferencesStore()
  const activeCompany = useAuthStore((s) => s.activeCompany)
  const qc            = useQueryClient()

  const [direction, setDirection] = useState<Direction>('')
  const [pending,   setPending]   = useState<'' | 'true'>('')
  const [page,      setPage]      = useState(1)

  const [wizardOpen,    setWizardOpen]    = useState(false)
  const [wizardPrefill, setWizardPrefill] = useState<WizardPrefill | null>(null)

  const PAGE_SIZE = 20

  const { data, isLoading } = useQuery({
    queryKey: ['fiscal-documents', activeCompany?.id, direction, pending, page],
    queryFn:  () => getFiscalDocuments({
      companyId: activeCompany!.id,
      direction:  direction || undefined,
      pending:    pending || undefined,
      page:       String(page),
      pageSize:   String(PAGE_SIZE),
    }),
    enabled: !!activeCompany?.id,
  })

  function openWizard(doc: FiscalDocument) {
    const counterpartCnpj = doc.doc_direction === 'income'
      ? (doc.recipient_cnpj ?? undefined)
      : (doc.issuer_cnpj ?? undefined)

    const prefill: WizardPrefill = {
      type:            (doc.doc_direction as 'income' | 'expense') ?? undefined,
      date:            doc.issue_date,
      amountCents:     doc.amount ? Math.round(doc.amount * 100) : undefined,
      counterpart:     doc.counterpart ?? undefined,
      description:     [DOC_TYPE_LABELS[doc.doc_type] ?? doc.doc_type, doc.doc_number].filter(Boolean).join(' '),
      counterpartCnpj,
    }
    setWizardPrefill(prefill)
    setWizardOpen(true)
  }

  function handleWizardClose() {
    setWizardOpen(false)
    setWizardPrefill(null)
    qc.invalidateQueries({ queryKey: ['transactions'] })
  }

  const docs  = data?.data ?? []
  const total = data?.count ?? 0
  const pages = Math.ceil(total / PAGE_SIZE)

  return (
    <div className="flex flex-col gap-4 p-4 md:p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-[var(--text-primary)]">{t('fiscalDocs_title')}</h1>
        <Button size="sm" variant="ghost" onClick={() => navigate('/settings/integrations')}>
          {t('fiscalDocs_configure')}
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        {(['', 'income', 'expense'] as Direction[]).map((d) => (
          <button
            key={d || 'all'}
            onClick={() => { setDirection(d); setPage(1) }}
            className={`h-8 px-3 rounded-full text-xs font-medium transition-colors cursor-pointer ${
              direction === d
                ? 'bg-[var(--accent)] text-white'
                : 'bg-[var(--bg-elevated)] text-[var(--text-secondary)] hover:bg-[var(--bg-border)]'
            }`}
          >
            {d === '' ? t('fiscalDocs_allDirections') : d === 'income' ? t('fiscalDocs_income') : t('fiscalDocs_expense')}
          </button>
        ))}

        <div className="w-px bg-[var(--bg-border)]" />

        {([['', t('fiscalDocs_allStatus')], ['true', t('fiscalDocs_pending')]] as ['' | 'true', string][]).map(([v, label]) => (
          <button
            key={v || 'all'}
            onClick={() => { setPending(v); setPage(1) }}
            className={`h-8 px-3 rounded-full text-xs font-medium transition-colors cursor-pointer ${
              pending === v
                ? 'bg-[var(--accent)] text-white'
                : 'bg-[var(--bg-elevated)] text-[var(--text-secondary)] hover:bg-[var(--bg-border)]'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="flex items-center justify-center h-40">
          <div className="h-5 w-5 border-2 border-[var(--accent)] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : docs.length === 0 ? (
        <Card padding="lg">
          <div className="flex flex-col items-center justify-center gap-3 py-8 text-center">
            <FileText className="h-8 w-8 text-[var(--text-muted)]" />
            <p className="text-sm font-medium text-[var(--text-primary)]">{t('fiscalDocs_empty')}</p>
            <p className="text-xs text-[var(--text-muted)] max-w-xs">{t('fiscalDocs_emptyHint')}</p>
            <Button size="sm" variant="ghost" onClick={() => navigate('/settings/integrations')}>
              {t('fiscalDocs_configure')}
            </Button>
          </div>
        </Card>
      ) : (
        <div className="flex flex-col gap-2">
          {docs.map((doc) => (
            <Card key={doc.id} padding="md">
              <div className="flex items-center gap-3">
                {/* Type / direction badge */}
                <div className="shrink-0">
                  <Badge variant={doc.doc_direction === 'income' ? 'success' : doc.doc_direction === 'expense' ? 'danger' : 'default'}>
                    {DOC_TYPE_LABELS[doc.doc_type] ?? doc.doc_type}
                  </Badge>
                </div>

                {/* Main info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-2">
                    <span className="text-sm font-medium text-[var(--text-primary)] truncate">
                      {doc.counterpart ?? (doc.doc_direction === 'income' ? doc.recipient_name : doc.issuer_name) ?? '—'}
                    </span>
                    {doc.doc_number && (
                      <span className="text-xs text-[var(--text-muted)] shrink-0">#{doc.doc_number}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 mt-0.5 text-xs text-[var(--text-muted)]">
                    <span>{formatDate(doc.issue_date)}</span>
                    {doc.doc_status === 'cancelled' && (
                      <span className="text-red-500">{t('fiscalDocs_cancelled')}</span>
                    )}
                  </div>
                </div>

                {/* Amount */}
                <div className="shrink-0 text-right">
                  <span className={`text-sm font-semibold ${
                    doc.doc_direction === 'income'
                      ? 'text-[var(--income)]'
                      : doc.doc_direction === 'expense'
                      ? 'text-[var(--expense)]'
                      : 'text-[var(--text-primary)]'
                  }`}>
                    {formatCurrency(doc.amount)}
                  </span>
                </div>

                {/* Action */}
                <div className="shrink-0 ml-1">
                  {doc.transaction_id ? (
                    <div className="flex items-center gap-1.5">
                      <CheckCircle2 className="h-4 w-4 text-green-500" />
                      <button
                        onClick={() => navigate(`/transactions?highlight=${doc.transaction_id}`)}
                        className="text-[var(--text-muted)] hover:text-[var(--accent)] transition-colors cursor-pointer"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ) : doc.doc_status !== 'cancelled' ? (
                    <Button size="sm" onClick={() => openWizard(doc)}>
                      <ArrowRight className="h-3.5 w-3.5" />
                      {t('fiscalDocs_createTransaction')}
                    </Button>
                  ) : null}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Pagination */}
      {pages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button size="sm" variant="ghost" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
            ‹
          </Button>
          <span className="text-xs text-[var(--text-muted)]">{page} / {pages}</span>
          <Button size="sm" variant="ghost" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>
            ›
          </Button>
        </div>
      )}

      {/* Transaction Wizard */}
      <TransactionWizard
        open={wizardOpen}
        onClose={handleWizardClose}
        editing={null}
        language={language}
        prefill={wizardPrefill ?? undefined}
      />
    </div>
  )
}
