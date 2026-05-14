import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { FileText, Clock, Download, CheckCircle, Send, Trash2, AlertCircle } from 'lucide-react'
import { Badge, Button, Card, ConfirmDialog, Select, useToast } from '@syncero/ui'
import {
  getFiscalBooks, createFiscalBook, updateFiscalBookStatus, deleteFiscalBook,
  getAccountPlans, getJournalEntriesForPeriod, getCompanyInfo, getExtCompanyInfo,
} from '@/lib/backend'
import { generateEcd } from '@/lib/ecdGenerator'
import { useCompanyContext } from '@/hooks/useCompanyContext'
import { usePreferencesStore } from '@/store/preferences'
import { useT } from '@/i18n'
import type { FiscalBook, FiscalBookStatus } from '@/types'

// ── Types ─────────────────────────────────────────────────────

type SpedTab = 'ecd' | 'ecf' | 'efd-contrib' | 'efd-icms'

// ── Period helpers ────────────────────────────────────────────

function buildPeriodOptions(): { value: string; label: string }[] {
  const now = new Date()
  const options: { value: string; label: string }[] = []
  for (let i = 0; i < 24; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const val = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    const label = format(d, 'MMM/yyyy', { locale: ptBR })
    options.push({ value: val, label: label.charAt(0).toUpperCase() + label.slice(1) })
  }
  return options
}

// ── Status helpers ────────────────────────────────────────────

function statusVariant(s: FiscalBookStatus): 'success' | 'info' | 'warning' {
  if (s === 'transmitted') return 'success'
  if (s === 'validated') return 'info'
  return 'warning'
}

// ── Coming Soon placeholder ───────────────────────────────────

function ComingSoon({ title, hint }: { title: string; hint: string }) {
  return (
    <Card>
      <div className="flex flex-col items-center gap-3 py-10 text-center">
        <div className="h-12 w-12 rounded-xl bg-[var(--bg-elevated)] flex items-center justify-center">
          <Clock className="h-6 w-6 text-[var(--text-muted)]" />
        </div>
        <div>
          <p className="text-sm font-medium text-[var(--text-primary)]">{title}</p>
          <p className="text-xs text-[var(--text-muted)] mt-1 max-w-xs">{hint}</p>
        </div>
      </div>
    </Card>
  )
}

// ── ECD Tab ───────────────────────────────────────────────────

function EcdTab({
  companyId,
  extCompanyId,
  period,
}: {
  companyId: string | undefined
  extCompanyId: string | undefined
  period: string
}) {
  const t = useT()
  const qc = useQueryClient()
  const { success: toastSuccess, error: toastError } = useToast()

  const [generating, setGenerating] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<FiscalBook | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [updatingId, setUpdatingId] = useState<string | null>(null)

  const QUERY_KEY = ['fiscal-books', companyId ?? extCompanyId, 'ecd']

  const { data: books = [], isLoading } = useQuery({
    queryKey: QUERY_KEY,
    queryFn: () => getFiscalBooks({ companyId, extCompanyId }),
  })

  const ecdBooks = books
    .filter(b => b.book_type === 'ecd' && b.reference_period === period)
    .sort((a, b) => b.created_at.localeCompare(a.created_at))

  const { data: accountPlans = [] } = useQuery({
    queryKey: ['account-plans', companyId ?? extCompanyId],
    queryFn: () => getAccountPlans({ companyId, extCompanyId }),
  })

  const hasPlans = accountPlans.length > 0

  const handleGenerate = async () => {
    setGenerating(true)
    try {
      // Fetch company info for CNPJ
      const companyInfo = companyId
        ? await getCompanyInfo(companyId)
        : await getExtCompanyInfo(extCompanyId!)

      // Fetch journal entries for the period
      const entries = await getJournalEntriesForPeriod({ companyId, extCompanyId, period })

      // Generate ECD text
      const ecdText = generateEcd(
        { name: companyInfo.name, cnpj: companyInfo.cnpj ?? '' },
        period,
        accountPlans,
        entries,
      )

      // Trigger browser download
      const blob = new Blob([ecdText], { type: 'text/plain;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `ECD_${period.replace('-', '_')}.txt`
      a.click()
      URL.revokeObjectURL(url)

      // Create fiscal_books record
      await createFiscalBook({
        ...(companyId ? { company_id: companyId } : { ext_company_id: extCompanyId }),
        book_type: 'ecd',
        reference_period: period,
        status: 'draft',
      })
      qc.invalidateQueries({ queryKey: QUERY_KEY })
      toastSuccess(t('sped_generate_ecd'))
    } catch {
      toastError(t('sped_generate_error'))
    } finally {
      setGenerating(false)
    }
  }

  const handleStatusUpdate = async (book: FiscalBook, next: FiscalBookStatus) => {
    setUpdatingId(book.id)
    try {
      await updateFiscalBookStatus(book.id, next)
      qc.invalidateQueries({ queryKey: QUERY_KEY })
    } catch {
      toastError(t('sped_status_error'))
    } finally {
      setUpdatingId(null)
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await deleteFiscalBook(deleteTarget.id)
      qc.invalidateQueries({ queryKey: QUERY_KEY })
      toastSuccess(t('common_deletedSuccess'))
      setDeleteTarget(null)
    } catch {
      toastError(t('sped_delete_error'))
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="flex flex-col gap-4">

      {/* Info card */}
      <Card>
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="h-9 w-9 rounded-lg bg-[var(--accent)]/10 flex items-center justify-center shrink-0">
              <FileText className="h-4 w-4 text-[var(--accent)]" />
            </div>
            <div>
              <p className="text-sm font-medium text-[var(--text-primary)]">{t('sped_tab_ecd')}</p>
              <p className="text-xs text-[var(--text-muted)] mt-0.5 max-w-md">{t('sped_ecd_description')}</p>
            </div>
          </div>
          <Button
            size="sm"
            onClick={handleGenerate}
            loading={generating}
            disabled={!hasPlans}
          >
            <Download className="h-4 w-4" />
            {generating ? t('sped_generating') : t('sped_generate_ecd')}
          </Button>
        </div>

        {!hasPlans && (
          <div className="flex items-center gap-2 mt-4 px-3 py-2.5 rounded-lg bg-[var(--warning)]/10 border border-[var(--warning)]/30">
            <AlertCircle className="h-4 w-4 text-[var(--warning)] shrink-0" />
            <p className="text-xs text-[var(--text-secondary)]">{t('sped_no_plans')}</p>
          </div>
        )}
      </Card>

      {/* History */}
      <div className="flex flex-col gap-2">
        <p className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider px-1">
          {t('sped_history')}
        </p>

        {isLoading ? (
          <Card padding="sm">
            <div className="h-12 flex items-center justify-center">
              <div className="h-4 w-4 border-2 border-[var(--accent)] border-t-transparent rounded-full animate-spin" />
            </div>
          </Card>
        ) : ecdBooks.length === 0 ? (
          <Card padding="sm">
            <p className="text-sm text-[var(--text-muted)] text-center py-4">{t('sped_empty')}</p>
          </Card>
        ) : (
          <Card padding="sm">
            <div className="divide-y divide-[var(--bg-border)]">
              {ecdBooks.map(book => (
                <div key={book.id} className="flex items-center justify-between py-3 gap-4">
                  <div className="flex items-center gap-3 min-w-0">
                    <Badge variant={statusVariant(book.status)}>
                      {book.status === 'transmitted' ? t('sped_transmitted')
                        : book.status === 'validated' ? t('sped_validated')
                        : t('sped_draft')}
                    </Badge>
                    <span className="text-xs text-[var(--text-muted)] shrink-0">
                      {t('sped_generated_at')} {format(new Date(book.created_at), 'dd/MM/yyyy HH:mm', { locale: ptBR })}
                    </span>
                    {book.transmitted_at && (
                      <span className="text-xs text-[var(--text-muted)] shrink-0">
                        · {t('sped_transmittedAt')} {format(new Date(book.transmitted_at), 'dd/MM/yyyy', { locale: ptBR })}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    {book.status === 'draft' && (
                      <button
                        onClick={() => handleStatusUpdate(book, 'validated')}
                        disabled={updatingId === book.id}
                        title={t('sped_mark_validated')}
                        className="p-1.5 rounded hover:bg-[var(--bg-border)] text-[var(--text-muted)] hover:text-[var(--accent)] transition-colors cursor-pointer disabled:opacity-40"
                      >
                        <CheckCircle className="h-4 w-4" />
                      </button>
                    )}
                    {book.status === 'validated' && (
                      <button
                        onClick={() => handleStatusUpdate(book, 'transmitted')}
                        disabled={updatingId === book.id}
                        title={t('sped_mark_transmitted')}
                        className="p-1.5 rounded hover:bg-[var(--bg-border)] text-[var(--text-muted)] hover:text-[var(--success)] transition-colors cursor-pointer disabled:opacity-40"
                      >
                        <Send className="h-4 w-4" />
                      </button>
                    )}
                    <button
                      onClick={() => setDeleteTarget(book)}
                      title={t('sped_delete_book')}
                      className="p-1.5 rounded hover:bg-[var(--bg-border)] text-[var(--text-muted)] hover:text-[var(--danger)] transition-colors cursor-pointer"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}
      </div>

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title={t('sped_delete_book')}
        message={t('sped_delete_confirm')}
        confirmLabel={t('sped_delete_book')}
        loading={deleting}
      />
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────

const PERIOD_OPTIONS = buildPeriodOptions()

const TABS: { id: SpedTab; labelKey: 'sped_tab_ecd' | 'sped_tab_ecf' | 'sped_tab_efd_contrib' | 'sped_tab_efd_icms' }[] = [
  { id: 'ecd',       labelKey: 'sped_tab_ecd' },
  { id: 'ecf',       labelKey: 'sped_tab_ecf' },
  { id: 'efd-contrib', labelKey: 'sped_tab_efd_contrib' },
  { id: 'efd-icms',  labelKey: 'sped_tab_efd_icms' },
]

export function Component() {
  const t = useT()
  const { companyId, extCompanyId } = useCompanyContext()
  usePreferencesStore(s => s.language) // triggers re-render on language change for child locale

  const [activeTab, setActiveTab] = useState<SpedTab>('ecd')
  const [period, setPeriod] = useState(() => {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  })

  return (
    <div className="flex flex-col gap-6">

      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-xl font-semibold text-[var(--text-primary)]">{t('sped_title')}</h1>
        <div className="flex items-center gap-2">
          <span className="text-xs text-[var(--text-muted)]">{t('sped_period_label')}</span>
          <Select
            size="sm"
            options={PERIOD_OPTIONS}
            value={period}
            onChange={v => setPeriod(v)}
            className="w-36"
          />
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 p-1 rounded-xl bg-[var(--bg-elevated)] w-fit">
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
              activeTab === tab.id
                ? 'bg-[var(--bg-base)] text-[var(--text-primary)] shadow-sm'
                : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
            }`}
          >
            {t(tab.labelKey)}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === 'ecd' && (
        <EcdTab companyId={companyId} extCompanyId={extCompanyId} period={period} />
      )}

      {activeTab === 'ecf' && (
        <ComingSoon title={t('sped_tab_ecf')} hint={t('sped_coming_soon_hint')} />
      )}

      {activeTab === 'efd-contrib' && (
        <ComingSoon title={t('sped_tab_efd_contrib')} hint={t('sped_coming_soon_hint')} />
      )}

      {activeTab === 'efd-icms' && (
        <ComingSoon title={t('sped_tab_efd_icms')} hint={t('sped_coming_soon_hint')} />
      )}
    </div>
  )
}
