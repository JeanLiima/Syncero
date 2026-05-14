import { useRef, useState } from 'react'
import { Upload, FileText, TrendingDown, TrendingUp, AlertCircle } from 'lucide-react'
import { format, parse, isValid } from 'date-fns'
import { useQuery } from '@tanstack/react-query'
import { Button, Modal, Select } from '@syncero/ui'
import { apiFetch } from '@/lib/api'
import { createExtTransaction } from '@/lib/backend'
import { useT } from '@/i18n'
import { parseNfe } from '@/lib/parsers/nfe'
import { parseOFX } from '@/lib/parsers/ofx'
import type { NfeParsed } from '@/lib/parsers/nfe'
import type { OFXTransaction } from '@/lib/parsers/ofx'
import type { ExternalCompany, TransactionNature } from '@/types'

export interface NfePrefill {
  type: 'income' | 'expense' | null
  date: string
  amountCents: number
  counterpart: string
  description: string
}

interface Props {
  open: boolean
  onClose: () => void
  extCompanyId: string
  onNfePrefill: (prefill: NfePrefill) => void
  onOFXImported: () => void
}

type View = 'dropzone' | 'nfe-preview' | 'ofx-review' | 'error'

const NATURE_INCOME: { value: TransactionNature; labelKey: string }[] = [
  { value: 'sale_service',         labelKey: 'nature_sale_service' },
  { value: 'loan_received',        labelKey: 'nature_loan_received' },
  { value: 'capital_contribution', labelKey: 'nature_capital_contribution' },
]

const NATURE_EXPENSE: { value: TransactionNature; labelKey: string }[] = [
  { value: 'operational_expense', labelKey: 'nature_operational_expense' },
  { value: 'product_cost',        labelKey: 'nature_product_cost' },
  { value: 'asset_purchase',      labelKey: 'nature_asset_purchase' },
  { value: 'debt_payment',        labelKey: 'nature_debt_payment' },
  { value: 'owner_withdrawal',    labelKey: 'nature_owner_withdrawal' },
]

interface OFXRowState {
  selected: boolean
  nature: TransactionNature
}

function fmtAmount(cents: number) {
  return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function fmtDate(iso: string) {
  const d = parse(iso, 'yyyy-MM-dd', new Date())
  return isValid(d) ? format(d, 'dd/MM/yyyy') : iso
}

function fmtDateShort(iso: string) {
  const d = parse(iso, 'yyyy-MM-dd', new Date())
  return isValid(d) ? format(d, 'dd/MM/yy') : iso
}

export function ImportModal({ open, onClose, extCompanyId, onNfePrefill, onOFXImported }: Props) {
  const t = useT()

  const { data: company } = useQuery({
    queryKey: ['external-company', extCompanyId],
    queryFn: () => apiFetch<ExternalCompany>(`/api/external-companies/${extCompanyId}`),
    enabled: open && !!extCompanyId,
    staleTime: 5 * 60 * 1000,
  })

  const fileRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)
  const [view, setView] = useState<View>('dropzone')
  const [nfeParsed, setNfeParsed] = useState<NfeParsed | null>(null)
  const [ofxTransactions, setOfxTransactions] = useState<OFXTransaction[]>([])
  const [ofxRows, setOfxRows] = useState<OFXRowState[]>([])
  const [importing, setImporting] = useState(false)
  const [globalNatureIncome, setGlobalNatureIncome] = useState<TransactionNature>('sale_service')
  const [globalNatureExpense, setGlobalNatureExpense] = useState<TransactionNature>('operational_expense')

  const incomeNatureOptions = NATURE_INCOME.map(n => ({ value: n.value, label: t(n.labelKey as Parameters<typeof t>[0]) }))
  const expenseNatureOptions = NATURE_EXPENSE.map(n => ({ value: n.value, label: t(n.labelKey as Parameters<typeof t>[0]) }))

  const reset = () => {
    setView('dropzone')
    setNfeParsed(null)
    setOfxTransactions([])
    setOfxRows([])
    if (fileRef.current) fileRef.current.value = ''
  }

  const handleClose = () => {
    reset()
    onClose()
  }

  const handleFile = (file: File) => {
    const name = file.name.toLowerCase()

    const readAs = (encoding: string, cb: (content: string) => void) => {
      const reader = new FileReader()
      reader.onload = e => {
        const content = e.target?.result as string
        if (!content) { setView('error'); return }
        cb(content)
      }
      reader.onerror = () => setView('error')
      reader.readAsText(file, encoding)
    }

    if (name.endsWith('.xml')) {
      readAs('UTF-8', content => {
        const cnpj = company?.cnpj ?? ''
        const result = parseNfe(content, cnpj)
        if (result) { setNfeParsed(result); setView('nfe-preview'); return }
        readAs('ISO-8859-1', content2 => {
          const result2 = parseNfe(content2, cnpj)
          if (result2) { setNfeParsed(result2); setView('nfe-preview') }
          else setView('error')
        })
      })
    } else if (name.endsWith('.ofx') || name.endsWith('.qfx')) {
      readAs('UTF-8', content => {
        const txns = parseOFX(content)
        if (txns.length === 0) { setView('error'); return }
        setOfxTransactions(txns)
        setOfxRows(txns.map(tx => ({
          selected: true,
          nature: tx.type === 'income' ? 'sale_service' : 'operational_expense',
        })))
        setView('ofx-review')
      })
    } else {
      setView('error')
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }

  const handleNfeContinue = () => {
    if (!nfeParsed) return
    onNfePrefill({
      type: nfeParsed.type,
      date: nfeParsed.date,
      amountCents: nfeParsed.amountCents,
      counterpart: nfeParsed.counterpart,
      description: nfeParsed.description,
    })
    reset()
    onClose()
  }

  const applyGlobalNature = (type: 'income' | 'expense', nature: TransactionNature) => {
    setOfxRows(prev => prev.map((r, i) =>
      ofxTransactions[i].type === type && r.selected ? { ...r, nature } : r
    ))
  }

  const handleOFXConfirm = async () => {
    setImporting(true)
    try {
      for (let i = 0; i < ofxTransactions.length; i++) {
        if (!ofxRows[i].selected) continue
        const tx = ofxTransactions[i]
        await createExtTransaction({
          ext_company_id: extCompanyId,
          type: tx.type,
          nature: ofxRows[i].nature,
          amount: tx.amountCents / 100,
          date: tx.date,
          description: tx.description || tx.counterpart,
          counterpart: tx.counterpart,
          is_paid: true,
          paid_at: tx.date,
        })
      }
      onOFXImported()
      reset()
      onClose()
    } finally {
      setImporting(false)
    }
  }

  const selectedCount = ofxRows.filter(r => r.selected).length

  const modalTitle = view === 'ofx-review'
    ? t('transactions_import_ofx_found').replace('{count}', String(ofxTransactions.length))
    : t('transactions_import_title')

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title={modalTitle}
      size={view === 'ofx-review' ? 'lg' : 'sm'}
    >
      <input
        ref={fileRef}
        type="file"
        accept=".xml,.ofx,.qfx"
        className="hidden"
        onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }}
      />

      {/* Dropzone */}
      {view === 'dropzone' && (
        <div
          onDragOver={e => { e.preventDefault(); setDragging(true) }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          onClick={() => fileRef.current?.click()}
          className={`flex flex-col items-center justify-center gap-4 min-h-48 rounded-xl border-2 border-dashed cursor-pointer transition-all ${
            dragging
              ? 'border-[var(--accent)] bg-[var(--accent)]/5'
              : 'border-[var(--bg-border)] hover:border-[var(--accent)] hover:bg-[var(--bg-elevated)]'
          }`}
        >
          <div className={`p-4 rounded-full transition-colors ${dragging ? 'bg-[var(--accent)]/10' : 'bg-[var(--bg-elevated)]'}`}>
            <Upload className={`h-7 w-7 transition-colors ${dragging ? 'text-[var(--accent)]' : 'text-[var(--text-muted)]'}`} />
          </div>
          <div className="flex flex-col items-center gap-1 text-center px-6">
            <span className="text-sm font-medium text-[var(--text-secondary)]">
              {t('transactions_import_dropzone')}
            </span>
            <span className="text-xs text-[var(--text-muted)]">
              {t('transactions_import_dropzone_hint')}
            </span>
            <span className="text-xs text-[var(--text-muted)] mt-1">
              {t('transactions_import_accept')}
            </span>
          </div>
        </div>
      )}

      {/* NFe preview */}
      {view === 'nfe-preview' && nfeParsed && (
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-2 mb-1">
            <FileText className="h-4 w-4 text-[var(--accent)]" />
            <span className="text-sm font-medium text-[var(--text-primary)]">
              {t('transactions_import_nfe_preview_title')}
            </span>
          </div>

          <div className="rounded-xl border border-[var(--bg-border)] overflow-hidden">
            <div className={`flex items-center gap-2 px-4 py-3 ${
              nfeParsed.type === 'income'
                ? 'bg-[var(--success)]/10 border-b border-[var(--success)]/20'
                : nfeParsed.type === 'expense'
                ? 'bg-[var(--danger)]/10 border-b border-[var(--danger)]/20'
                : 'bg-[var(--bg-elevated)] border-b border-[var(--bg-border)]'
            }`}>
              {nfeParsed.type === 'income' && <TrendingUp className="h-4 w-4 text-[var(--success)] shrink-0" />}
              {nfeParsed.type === 'expense' && <TrendingDown className="h-4 w-4 text-[var(--danger)] shrink-0" />}
              <span className={`text-sm font-medium ${
                nfeParsed.type === 'income' ? 'text-[var(--success)]'
                : nfeParsed.type === 'expense' ? 'text-[var(--danger)]'
                : 'text-[var(--text-muted)]'
              }`}>
                {nfeParsed.type === 'income'
                  ? t('transactions_import_nfe_type_income')
                  : nfeParsed.type === 'expense'
                  ? t('transactions_import_nfe_type_expense')
                  : t('transactions_import_nfe_type_unknown')}
              </span>
            </div>

            <div className="flex flex-col divide-y divide-[var(--bg-border)]">
              {nfeParsed.counterpart && (
                <div className="flex items-center justify-between gap-3 px-4 py-2.5">
                  <span className="text-xs text-[var(--text-muted)] shrink-0">{t('transactions_import_nfe_counterpart')}</span>
                  <span className="text-sm text-[var(--text-primary)] font-medium text-right">{nfeParsed.counterpart}</span>
                </div>
              )}
              <div className="flex justify-between items-center px-4 py-2.5">
                <span className="text-xs text-[var(--text-muted)]">{t('transactions_import_nfe_date')}</span>
                <span className="text-sm text-[var(--text-secondary)]">{fmtDate(nfeParsed.date)}</span>
              </div>
              <div className="flex justify-between items-center px-4 py-2.5">
                <span className="text-xs text-[var(--text-muted)]">{t('transactions_import_nfe_amount')}</span>
                <span className="text-sm font-semibold text-[var(--text-primary)]">{fmtAmount(nfeParsed.amountCents)}</span>
              </div>
              {nfeParsed.description && (
                <div className="flex justify-between items-center px-4 py-2.5 gap-4">
                  <span className="text-xs text-[var(--text-muted)] shrink-0">{t('extTx_description')}</span>
                  <span className="text-sm text-[var(--text-secondary)] text-right truncate">{nfeParsed.description}</span>
                </div>
              )}
            </div>
          </div>

          {nfeParsed.type === null && (
            <div className="flex items-start gap-2.5 px-3 py-2.5 rounded-lg bg-[var(--warning)]/10 border border-[var(--warning)]/30">
              <AlertCircle className="h-4 w-4 shrink-0 text-[var(--warning)] mt-0.5" />
              <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                {t('transactions_import_nfe_cnpj_warning')}
              </p>
            </div>
          )}

          <div className="flex items-center justify-between pt-2 border-t border-[var(--bg-border)]">
            <Button variant="ghost" size="sm" onClick={reset}>
              {t('extTx_cancel')}
            </Button>
            {nfeParsed.type === null ? (
              <Button variant="ghost" size="sm" onClick={handleNfeContinue}>
                {t('transactions_import_nfe_proceed_anyway')}
              </Button>
            ) : (
              <Button size="sm" onClick={handleNfeContinue}>
                {t('transactions_import_nfe_continue')}
              </Button>
            )}
          </div>
        </div>
      )}

      {/* OFX review */}
      {view === 'ofx-review' && (
        <div className="flex flex-col gap-4">
          {/* Global defaults */}
          <div className="flex flex-wrap gap-3 p-3 rounded-lg bg-[var(--bg-elevated)] border border-[var(--bg-border)]">
            <div className="flex flex-col gap-1 min-w-40 flex-1">
              <span className="text-xs text-[var(--text-muted)]">
                {t('transactions_import_ofx_defaultNature')} — {t('extTx_income')}
              </span>
              <Select
                size="sm"
                options={incomeNatureOptions}
                value={globalNatureIncome}
                onChange={v => {
                  const n = v as TransactionNature
                  setGlobalNatureIncome(n)
                  applyGlobalNature('income', n)
                }}
              />
            </div>
            <div className="flex flex-col gap-1 min-w-40 flex-1">
              <span className="text-xs text-[var(--text-muted)]">
                {t('transactions_import_ofx_defaultNature')} — {t('extTx_expense')}
              </span>
              <Select
                size="sm"
                options={expenseNatureOptions}
                value={globalNatureExpense}
                onChange={v => {
                  const n = v as TransactionNature
                  setGlobalNatureExpense(n)
                  applyGlobalNature('expense', n)
                }}
              />
            </div>
          </div>

          {/* Table */}
          <div className="rounded-lg border border-[var(--bg-border)] overflow-hidden max-h-72 overflow-y-auto">
            <div className="grid grid-cols-[1.5rem_3.5rem_1.5rem_1fr_5rem_7rem] gap-2 px-3 py-2 bg-[var(--bg-elevated)] border-b border-[var(--bg-border)]">
              <input
                type="checkbox"
                checked={selectedCount === ofxTransactions.length}
                onChange={e => setOfxRows(prev => prev.map(r => ({ ...r, selected: e.target.checked })))}
                className="h-3.5 w-3.5 accent-[var(--accent)] cursor-pointer"
              />
              <span className="text-xs text-[var(--text-muted)]">{t('extTx_date')}</span>
              <span />
              <span className="text-xs text-[var(--text-muted)]">{t('extTx_description')}</span>
              <span className="text-xs text-[var(--text-muted)] text-right">{t('extTx_amount')}</span>
              <span className="text-xs text-[var(--text-muted)]">{t('extTx_nature')}</span>
            </div>
            <div className="divide-y divide-[var(--bg-border)]">
              {ofxTransactions.map((tx, i) => {
                const row = ofxRows[i]
                const natureOpts = tx.type === 'income' ? incomeNatureOptions : expenseNatureOptions
                return (
                  <div
                    key={tx.fitId}
                    className={`grid grid-cols-[1.5rem_3.5rem_1.5rem_1fr_5rem_7rem] gap-2 items-center px-3 py-2 transition-colors ${
                      row.selected ? 'bg-[var(--bg-base)]' : 'bg-[var(--bg-elevated)] opacity-50'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={row.selected}
                      onChange={e => setOfxRows(prev => prev.map((r, idx) => idx === i ? { ...r, selected: e.target.checked } : r))}
                      className="h-3.5 w-3.5 accent-[var(--accent)] cursor-pointer"
                    />
                    <span className="text-xs text-[var(--text-muted)] font-mono">{fmtDateShort(tx.date)}</span>
                    <span className="flex items-center justify-center">
                      {tx.type === 'income'
                        ? <TrendingUp className="h-3.5 w-3.5 text-[var(--success)]" />
                        : <TrendingDown className="h-3.5 w-3.5 text-[var(--danger)]" />}
                    </span>
                    <span className="text-xs text-[var(--text-primary)] truncate" title={tx.description}>
                      {tx.description}
                    </span>
                    <span className={`text-xs font-medium tabular-nums text-right ${
                      tx.type === 'income' ? 'text-[var(--success)]' : 'text-[var(--danger)]'
                    }`}>
                      R$ {(tx.amountCents / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                    <Select
                      size="sm"
                      options={natureOpts}
                      value={row.nature}
                      onChange={v => setOfxRows(prev => prev.map((r, idx) => idx === i ? { ...r, nature: v as TransactionNature } : r))}
                    />
                  </div>
                )
              })}
            </div>
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-[var(--bg-border)]">
            <Button variant="ghost" size="sm" onClick={reset}>
              {t('extTx_cancel')}
            </Button>
            <Button
              size="sm"
              onClick={handleOFXConfirm}
              loading={importing}
              disabled={selectedCount === 0}
            >
              {selectedCount === 0
                ? t('transactions_import_ofx_noneSelected')
                : t('transactions_import_ofx_confirm').replace('{count}', String(selectedCount))}
            </Button>
          </div>
        </div>
      )}

      {/* Error */}
      {view === 'error' && (
        <div className="flex flex-col items-center gap-4 py-6">
          <div className="p-3 rounded-full bg-[var(--danger)]/10">
            <AlertCircle className="h-7 w-7 text-[var(--danger)]" />
          </div>
          <p className="text-sm text-[var(--text-secondary)] text-center px-4">
            {t('transactions_import_error_parse')}
          </p>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={handleClose}>
              {t('extTx_cancel')}
            </Button>
            <Button size="sm" onClick={reset}>
              {t('transactions_import_dropzone_hint')}
            </Button>
          </div>
        </div>
      )}
    </Modal>
  )
}
