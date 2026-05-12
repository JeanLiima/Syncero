import { useState } from 'react'
import { Button, Modal } from '@syncero/ui'
import { format } from 'date-fns'
import { useT } from '@/i18n'
import type { JournalEntry } from '@/types'

// ── Export helpers ─────────────────────────────────────────────

function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

// One row per journal_entry_line — standard format for Brazilian accounting software
// (Domínio, Questor, Alterdata, TOTVS Protheus, Sage)
// Semicolons as separator — Brazil uses comma as decimal separator
function buildRows(entries: JournalEntry[]) {
  const rows: (string | number)[][] = []
  for (const entry of entries) {
    const date = format(new Date(entry.entry_date + 'T00:00:00'), 'dd/MM/yyyy')
    for (const line of entry.journal_entry_lines ?? []) {
      rows.push([
        date,
        entry.description,
        entry.external_ref ?? '',
        line.account_plans?.code ?? '',
        line.account_plans?.name ?? '',
        line.side === 'debit'  ? Number(line.amount) : '',
        line.side === 'credit' ? Number(line.amount) : '',
        entry.source,
      ])
    }
  }
  return rows
}

const HEADERS = [
  'Data', 'Histórico', 'Documento',
  'Conta', 'Nome da Conta',
  'Débito', 'Crédito', 'Origem',
]

function exportCSV(entries: JournalEntry[], period: string) {
  const rows = buildRows(entries)
  const escape = (v: string | number) =>
    typeof v === 'number'
      ? String(v).replace('.', ',')
      : `"${String(v).replace(/"/g, '""')}"`

  const lines = [
    HEADERS.map(h => `"${h}"`).join(';'),
    ...rows.map(r => r.map(escape).join(';')),
  ]
  const blob = new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' })
  download(blob, `lancamentos-${period}.csv`)
}

async function exportXLSX(entries: JournalEntry[], period: string) {
  const XLSX = await import('xlsx')
  const data = [HEADERS, ...buildRows(entries)]
  const ws = XLSX.utils.aoa_to_sheet(data)

  // Format number columns as numbers in Excel
  const numCols = [5, 6] // Débito, Crédito (0-indexed)
  for (let r = 1; r < data.length; r++) {
    for (const c of numCols) {
      const cellAddr = XLSX.utils.encode_cell({ r, c })
      if (ws[cellAddr] && typeof ws[cellAddr].v === 'number') {
        ws[cellAddr].t = 'n'
        ws[cellAddr].z = '#,##0.00'
      }
    }
  }

  // Auto column widths
  ws['!cols'] = [10, 40, 15, 12, 35, 14, 14, 14].map(w => ({ wch: w }))

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Lançamentos')
  XLSX.writeFile(wb, `lancamentos-${period}.xlsx`)
}

// ── Modal ─────────────────────────────────────────────────────

interface Props {
  open: boolean
  onClose: () => void
  entries: JournalEntry[]
  period: string
}

export function JournalExportModal({ open, onClose, entries, period }: Props) {
  const t = useT()
  const [format, setFormat] = useState<'csv' | 'xlsx'>('csv')
  const [loading, setLoading] = useState(false)

  const handleExport = async () => {
    if (entries.length === 0) return
    setLoading(true)
    try {
      if (format === 'csv') exportCSV(entries, period)
      else await exportXLSX(entries, period)
      onClose()
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('lancamentos_export_title')}
      size="sm"
      footer={
        <div className="flex items-center justify-between">
          <Button variant="ghost" size="sm" onClick={onClose} disabled={loading}>
            {t('lancamentos_export_cancel')}
          </Button>
          <Button
            size="sm"
            onClick={handleExport}
            disabled={entries.length === 0 || loading}
            loading={loading}
          >
            {t('lancamentos_export_confirm')}
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        <p className="text-xs text-[var(--text-muted)]">
          {t('lancamentos_export_subtitle')}
        </p>

        <div className="flex flex-col gap-2">
          {(['csv', 'xlsx'] as const).map(f => (
            <label
              key={f}
              className={`flex items-center gap-3 rounded-lg border px-4 py-3 cursor-pointer transition-colors ${
                format === f
                  ? 'border-[var(--accent)] bg-[var(--accent)]/5'
                  : 'border-[var(--bg-border)] hover:border-[var(--accent)]/40'
              }`}
            >
              <input
                type="radio"
                name="format"
                value={f}
                checked={format === f}
                onChange={() => setFormat(f)}
                className="accent-[var(--accent)]"
              />
              <div>
                <p className="text-sm font-medium text-[var(--text-primary)]">
                  {t(f === 'csv' ? 'lancamentos_export_csv' : 'lancamentos_export_xlsx')}
                </p>
                {f === 'csv' && (
                  <p className="text-xs text-[var(--text-muted)] mt-0.5">
                    Uma linha por partida (D/C) · separador ponto-e-vírgula
                  </p>
                )}
              </div>
            </label>
          ))}
        </div>

        <div className="rounded-lg bg-[var(--bg-elevated)] border border-[var(--bg-border)] px-4 py-3">
          <p className="text-xs font-mono text-[var(--text-muted)]">
            Data;Histórico;Documento;Conta;Nome da Conta;Débito;Crédito;Origem
          </p>
          <p className="text-xs text-[var(--text-muted)] mt-1.5">
            {entries.length} {entries.length !== 1 ? t('lancamentos_countPlural') : t('lancamentos_countSingular')}
            {' · '}
            {(entries.flatMap(e => e.journal_entry_lines ?? []).length)} partidas
          </p>
        </div>

        {entries.length === 0 && (
          <p className="text-xs text-[var(--warning)] text-center">{t('lancamentos_export_empty')}</p>
        )}
      </div>
    </Modal>
  )
}
