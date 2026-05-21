import { useEffect, useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { format } from 'date-fns'
import { ptBR, enUS } from 'date-fns/locale'
import { FileText, Clock, Download, CheckCircle, Send, Trash2, ChevronLeft, ChevronRight, CalendarDays } from 'lucide-react'
import { AlertBox, Badge, Button, Card, ConfirmDialog, useToast } from '@syncero/ui'
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

// ── MonthPicker ───────────────────────────────────────────────

const MONTHS_PT = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
const MONTHS_EN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function MonthPicker({
  value,
  onChange,
  language,
}: {
  value: string   // "YYYY-MM"
  onChange: (v: string) => void
  language: 'pt' | 'en'
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const [year, setYear] = useState(() => parseInt(value.split('-')[0]))
  const locale = language === 'en' ? enUS : ptBR
  const months = language === 'en' ? MONTHS_EN : MONTHS_PT
  const now = new Date()
  const maxYear = now.getFullYear()

  const [selYear, selMonthIdx] = value.split('-').map(Number)
  const displayLabel = (() => {
    const d = new Date(selYear, selMonthIdx - 1, 1)
    const raw = format(d, 'MMM/yyyy', { locale })
    return raw.charAt(0).toUpperCase() + raw.slice(1)
  })()

  useEffect(() => {
    const h = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  const select = (monthIdx: number) => {
    onChange(`${year}-${String(monthIdx + 1).padStart(2, '0')}`)
    setOpen(false)
  }

  const isFuture = (monthIdx: number) =>
    year > maxYear || (year === maxYear && monthIdx > now.getMonth())

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => { setYear(selYear); setOpen(o => !o) }}
        className="flex items-center gap-2 h-8 px-3 rounded-[var(--radius-md)] bg-[var(--bg-elevated)] border border-[var(--bg-border)] text-sm text-[var(--text-primary)] hover:border-[var(--accent)] transition-colors cursor-pointer"
      >
        <CalendarDays className="h-3.5 w-3.5 text-[var(--text-muted)]" />
        {displayLabel}
      </button>

      {open && (
        <div className="absolute right-0 top-10 z-50 w-56 rounded-xl border border-[var(--bg-border)] bg-[var(--bg-elevated)] shadow-xl p-3 flex flex-col gap-2">
          {/* Year navigation */}
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => setYear(y => y - 1)}
              className="h-6 w-6 flex items-center justify-center rounded hover:bg-[var(--bg-border)] text-[var(--text-muted)] cursor-pointer transition-colors"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </button>
            <span className="text-sm font-medium text-[var(--text-primary)]">{year}</span>
            <button
              type="button"
              onClick={() => setYear(y => Math.min(y + 1, maxYear))}
              disabled={year >= maxYear}
              className="h-6 w-6 flex items-center justify-center rounded hover:bg-[var(--bg-border)] text-[var(--text-muted)] disabled:opacity-30 cursor-pointer transition-colors"
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* Month grid */}
          <div className="grid grid-cols-3 gap-1">
            {months.map((label, i) => {
              const isSelected = year === selYear && i + 1 === selMonthIdx
              const disabled = isFuture(i)
              return (
                <button
                  key={i}
                  type="button"
                  disabled={disabled}
                  onClick={() => select(i)}
                  className={`py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                    isSelected
                      ? 'bg-[var(--accent)] text-white'
                      : disabled
                      ? 'text-[var(--text-muted)] opacity-30 cursor-not-allowed'
                      : 'text-[var(--text-secondary)] hover:bg-[var(--bg-border)] hover:text-[var(--text-primary)]'
                  }`}
                >
                  {label}
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
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
          <AlertBox variant="warning" className="mt-4">{t('sped_no_plans')}</AlertBox>
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

  const language = usePreferencesStore(s => s.language)
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
        <MonthPicker value={period} onChange={setPeriod} language={language} />
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
