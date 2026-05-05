import { format } from 'date-fns'
import { ptBR, enUS } from 'date-fns/locale'
import type { Transaction } from '@/types'

export type TxRow = Transaction & { is_classified?: boolean }

// ── Column definitions ────────────────────────────────────────

export type ExportColumnId =
  | 'date' | 'paid_at' | 'description' | 'type' | 'amount'
  | 'status' | 'classification' | 'category' | 'contact' | 'nature'
  | 'payment_method' | 'bank' | 'installment' | 'notes'

export interface ExportColumnDef {
  id: ExportColumnId
  label: string
  defaultOn: boolean
  getValue: (row: TxRow) => string | number
}

export function buildColumns(t: (k: string) => string, language: 'pt' | 'en'): ExportColumnDef[] {
  const locale = language === 'en' ? enUS : ptBR
  const fmt = (d: string | null | undefined) =>
    d ? format(new Date(d.includes('T') ? d : d + 'T00:00:00'), 'dd/MM/yyyy', { locale }) : ''

  return [
    {
      id: 'date',
      label: t('export_col_date'),
      defaultOn: true,
      getValue: (r) => fmt(r.date),
    },
    {
      id: 'paid_at',
      label: t('export_col_paidAt'),
      defaultOn: false,
      getValue: (r) => fmt(r.paid_at),
    },
    {
      id: 'description',
      label: t('export_col_description'),
      defaultOn: true,
      getValue: (r) => r.description,
    },
    {
      id: 'type',
      label: t('export_col_type'),
      defaultOn: true,
      getValue: (r) => r.type === 'income' ? t('transactions_income_badge') : t('transactions_expense_badge'),
    },
    {
      id: 'amount',
      label: t('export_col_amount'),
      defaultOn: true,
      getValue: (r) => r.amount,
    },
    {
      id: 'status',
      label: t('export_col_status'),
      defaultOn: true,
      getValue: (r) => {
        if (!r.is_paid) return r.type === 'income' ? t('transactions_toReceive') : t('transactions_pending')
        return r.type === 'income' ? t('transactions_received') : t('transactions_paid')
      },
    },
    {
      id: 'classification',
      label: t('export_col_classification'),
      defaultOn: true,
      getValue: (r) => r.is_classified ? t('classify_badge_done') : t('classify_badge_pending'),
    },
    {
      id: 'category',
      label: t('export_col_category'),
      defaultOn: true,
      getValue: (r) => (r.categories as { name: string } | undefined)?.name ?? '',
    },
    {
      id: 'contact',
      label: t('export_col_contact'),
      defaultOn: true,
      getValue: (r) => (r.contacts as { name: string } | undefined)?.name ?? r.counterpart ?? '',
    },
    {
      id: 'nature',
      label: t('export_col_nature'),
      defaultOn: false,
      getValue: (r) => r.nature ? t(`nature_${r.nature}`) : '',
    },
    {
      id: 'payment_method',
      label: t('export_col_paymentMethod'),
      defaultOn: false,
      getValue: (r) => {
        if (r.payment_method === 'cash') return t('transactions_detail_cash')
        if (r.payment_method === 'bank') return t('transactions_detail_bank')
        return ''
      },
    },
    {
      id: 'bank',
      label: t('export_col_bank'),
      defaultOn: false,
      getValue: (r) => (r.banks as { name: string } | undefined)?.name ?? '',
    },
    {
      id: 'installment',
      label: t('export_col_installment'),
      defaultOn: false,
      getValue: (r) =>
        r.is_installment && r.installment_number && r.installment_count
          ? `${r.installment_number}/${r.installment_count}`
          : '',
    },
    {
      id: 'notes',
      label: t('export_col_notes'),
      defaultOn: false,
      getValue: (r) => r.notes ?? '',
    },
  ]
}

// ── Download trigger ──────────────────────────────────────────

function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

// ── CSV ───────────────────────────────────────────────────────

export function exportCSV(rows: TxRow[], cols: ExportColumnDef[], filename: string) {
  const headers = cols.map((c) => `"${c.label}"`)
  const lines = rows.map((r) =>
    cols.map((c) => {
      const v = c.getValue(r)
      return typeof v === 'number' ? v : `"${String(v).replace(/"/g, '""')}"`
    }).join(',')
  )
  const csv = [headers.join(','), ...lines].join('\n')
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' })
  download(blob, filename)
}

// ── Excel ─────────────────────────────────────────────────────

export async function exportXLSX(rows: TxRow[], cols: ExportColumnDef[], filename: string) {
  const XLSX = await import('xlsx')
  const data = [
    cols.map((c) => c.label),
    ...rows.map((r) => cols.map((c) => c.getValue(r))),
  ]
  const ws = XLSX.utils.aoa_to_sheet(data)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Lançamentos')
  XLSX.writeFile(wb, filename)
}

// ── PDF ───────────────────────────────────────────────────────

export async function exportPDF(
  rows: TxRow[],
  cols: ExportColumnDef[],
  filename: string,
  title: string,
) {
  const { default: jsPDF } = await import('jspdf')
  const { default: autoTable } = await import('jspdf-autotable')

  const doc = new jsPDF({ orientation: cols.length > 6 ? 'landscape' : 'portrait' })
  doc.setFontSize(13)
  doc.text(title, 14, 16)
  doc.setFontSize(9)
  doc.setTextColor(130)
  doc.text(new Date().toLocaleDateString('pt-BR'), 14, 22)

  autoTable(doc, {
    startY: 28,
    head: [cols.map((c) => c.label)],
    body: rows.map((r) => cols.map((c) => String(c.getValue(r)))),
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [16, 185, 129] },
    alternateRowStyles: { fillColor: [245, 247, 250] },
  })

  doc.save(filename)
}
