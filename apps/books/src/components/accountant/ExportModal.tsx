import { useState, useMemo } from 'react'
import { Modal, Button, Checkbox } from '@syncero/ui'
import { useT } from '@/i18n'
import { usePreferencesStore } from '@/store/preferences'
import { getTransactions } from '@/lib/backend'
import { buildColumns, exportCSV, exportXLSX, exportPDF } from './exportUtils'
import type { TxRow } from './exportUtils'

type Format = 'csv' | 'xlsx' | 'pdf'

interface TransactionFilters {
  type?: string
  is_paid?: boolean
  date_from?: string
  date_to?: string
  search?: string
}

interface Props {
  open: boolean
  onClose: () => void
  filters: TransactionFilters
  companyId?: string
  extCompanyId?: string
}

export function ExportModal({ open, onClose, filters, companyId, extCompanyId }: Props) {
  const t = useT()
  const { language } = usePreferencesStore()

  const allColumns = useMemo(() => buildColumns(t as (k: string) => string, language), [t, language])

  const [format, setFormat] = useState<Format>('xlsx')
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(allColumns.filter((c) => c.defaultOn).map((c) => c.id))
  )
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const toggleCol = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })

  const allSelected = selected.size === allColumns.length
  const toggleAll = () =>
    setSelected(allSelected ? new Set() : new Set(allColumns.map((c) => c.id)))

  const activeCols = allColumns.filter((c) => selected.has(c.id))

  const handleExport = async () => {
    if (activeCols.length === 0) return
    setLoading(true)
    setError(null)
    try {
      const result = await getTransactions({
        ...(extCompanyId ? { extCompanyId } : { companyId }),
        pageSize: '1000',
        page: '1',
        ...(filters.type        ? { type:      filters.type }                 : {}),
        ...(filters.is_paid !== undefined ? { is_paid: String(filters.is_paid) } : {}),
        ...(filters.date_from   ? { date_from: filters.date_from }             : {}),
        ...(filters.date_to     ? { date_to:   filters.date_to }               : {}),
        ...(filters.search      ? { search:    filters.search }                : {}),
      })

      const rows = (result.data ?? []) as TxRow[]
      const date = new Date().toISOString().slice(0, 10)
      const base = `lancamentos_${date}`
      const title = t('export_title')

      if (format === 'csv')  exportCSV(rows,  activeCols, `${base}.csv`)
      if (format === 'xlsx') await exportXLSX(rows, activeCols, `${base}.xlsx`)
      if (format === 'pdf')  await exportPDF(rows,  activeCols, `${base}.pdf`, title)

      onClose()
    } catch {
      setError(t('export_fetchError'))
    } finally {
      setLoading(false)
    }
  }

  const formats: { id: Format; label: string }[] = [
    { id: 'xlsx', label: 'Excel (.xlsx)' },
    { id: 'csv',  label: 'CSV' },
    { id: 'pdf',  label: 'PDF' },
  ]

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('export_title')}
      size="md"
      footer={
        <div className="flex items-center justify-between">
          <Button variant="ghost" size="sm" onClick={onClose} disabled={loading}>
            {t('export_cancel')}
          </Button>
          <Button
            size="sm"
            onClick={handleExport}
            loading={loading}
            disabled={activeCols.length === 0}
          >
            {t('export_confirm')}
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-5">

        {/* Format */}
        <div className="flex flex-col gap-2">
          <span className="text-xs font-medium text-[var(--text-secondary)]">{t('export_format')}</span>
          <div className="flex gap-2">
            {formats.map(({ id, label }) => (
              <button
                key={id}
                type="button"
                onClick={() => setFormat(id)}
                className={`flex-1 py-1.5 rounded text-sm font-medium transition-colors cursor-pointer ${
                  format === id
                    ? 'bg-[var(--success)] text-white'
                    : 'bg-[var(--bg-elevated)] text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Columns */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-[var(--text-secondary)]">{t('export_columns')}</span>
            <button
              type="button"
              onClick={toggleAll}
              className="cursor-pointer text-xs text-[var(--success)] hover:underline"
            >
              {allSelected ? t('export_deselectAll') : t('export_selectAll')}
            </button>
          </div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-2 rounded-[var(--radius-md)] border border-[var(--bg-border)] bg-[var(--bg-elevated)] p-3">
            {allColumns.map((col) => (
              <Checkbox
                key={col.id}
                label={col.label}
                checked={selected.has(col.id)}
                onChange={() => toggleCol(col.id)}
              />
            ))}
          </div>
        </div>

        {error && <p className="text-xs text-[var(--danger)]">{error}</p>}

        <p className="text-xs text-[var(--text-muted)]">
          {t('export_limitNote').replace('{n}', '1.000')}
        </p>
      </div>
    </Modal>
  )
}
