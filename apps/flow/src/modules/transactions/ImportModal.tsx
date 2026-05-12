import { useRef, useState } from 'react'
import { Upload, FileText, TrendingDown, TrendingUp, AlertCircle } from 'lucide-react'
import { format, parse, isValid } from 'date-fns'
import { useQuery } from '@tanstack/react-query'
import { Button, Modal } from '@syncero/ui'
import { useT } from '@/i18n'
import { useAuthStore } from '@/store/auth'
import { getCompany } from '@/lib/backend'
import { parseNfe } from '@/lib/parsers/nfe'
import { parseOFX } from '@/lib/parsers/ofx'
import { OFXReviewTable } from './OFXReviewTable'
import type { WizardPrefill } from './useTransactionWizard'
import type { NfeParsed } from '@/lib/parsers/nfe'
import type { OFXTransaction } from '@/lib/parsers/ofx'

interface Props {
  open: boolean
  onClose: () => void
  onNfePrefill: (prefill: WizardPrefill) => void
}

type View = 'dropzone' | 'nfe-preview' | 'ofx-review' | 'error'

function debugNfe(xml: string) {
  try {
    const clean = xml.replace(/\s+xmlns(?::\w+)?="[^"]*"/g, '')
    const doc = new DOMParser().parseFromString(clean, 'text/xml')
    if (doc.documentElement.nodeName === 'parsererror' || doc.querySelector('parsererror')) {
      console.error('[NFe] XML parse error:', doc.documentElement.textContent)
      return
    }
    const hasInfNFe = !!doc.querySelector('infNFe')
    console.info('[NFe] infNFe found:', hasInfNFe)
    console.info('[NFe] root tag:', doc.documentElement.nodeName)
    console.info('[NFe] emit CNPJ:', doc.querySelector('emit CNPJ')?.textContent)
    console.info('[NFe] dest CNPJ:', doc.querySelector('dest CNPJ')?.textContent)
    console.info('[NFe] vNF:', doc.querySelector('ICMSTot vNF')?.textContent)
  } catch (e) {
    console.error('[NFe] exception:', e)
  }
}

function fmtAmount(cents: number) {
  return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function fmtDate(iso: string) {
  const d = parse(iso, 'yyyy-MM-dd', new Date())
  return isValid(d) ? format(d, 'dd/MM/yyyy') : iso
}

export function ImportModal({ open, onClose, onNfePrefill }: Props) {
  const t = useT()
  const activeCompany = useAuthStore((s) => s.activeCompany)
  const { data: company } = useQuery({
    queryKey: ['company', activeCompany?.id],
    queryFn: () => getCompany(activeCompany!.id),
    enabled: !!activeCompany?.id,
    staleTime: 5 * 60 * 1000,
  })
  const fileRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)
  const [view, setView] = useState<View>('dropzone')
  const [nfeParsed, setNfeParsed] = useState<NfeParsed | null>(null)
  const [ofxTransactions, setOfxTransactions] = useState<OFXTransaction[]>([])

  const reset = () => {
    setView('dropzone')
    setNfeParsed(null)
    setOfxTransactions([])
    if (fileRef.current) fileRef.current.value = ''
  }

  const handleClose = () => {
    reset()
    onClose()
  }

  const handleFile = (file: File) => {
    const name = file.name.toLowerCase()

    const tryParseXml = (content: string) => {
      const cnpj = company?.cnpj ?? ''
      const result = parseNfe(content, cnpj)
      if (result) { setNfeParsed(result); setView('nfe-preview') }
      else setView('error')
    }

    const readAs = (encoding: string, onSuccess: (content: string) => void) => {
      const reader = new FileReader()
      reader.onload = (e) => {
        const content = e.target?.result as string
        if (!content) { setView('error'); return }
        onSuccess(content)
      }
      reader.onerror = () => setView('error')
      reader.readAsText(file, encoding)
    }

    if (name.endsWith('.xml')) {
      // Try UTF-8 first; fall back to ISO-8859-1 (common in older NFe files)
      readAs('UTF-8', (content) => {
        const cnpj = company?.cnpj ?? ''
        const result = parseNfe(content, cnpj)
        if (result) { setNfeParsed(result); setView('nfe-preview'); return }
        debugNfe(content)
        readAs('ISO-8859-1', tryParseXml)
      })
    } else if (name.endsWith('.ofx') || name.endsWith('.qfx')) {
      readAs('UTF-8', (content) => {
        const txns = parseOFX(content)
        if (txns.length === 0) { setView('error'); return }
        setOfxTransactions(txns)
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

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) handleFile(file)
  }

  const handleNfeContinue = () => {
    if (!nfeParsed) return
    const counterpartCnpj = nfeParsed.type === 'income'  ? nfeParsed.cnpjRecipient
                          : nfeParsed.type === 'expense' ? nfeParsed.cnpjIssuer
                          : undefined
    onNfePrefill({
      type: nfeParsed.type ?? undefined,
      date: nfeParsed.date,
      amountCents: nfeParsed.amountCents,
      counterpart: nfeParsed.counterpart || undefined,
      description: nfeParsed.description || undefined,
      counterpartCnpj: counterpartCnpj || undefined,
    })
  }

  const modalTitle = view === 'ofx-review'
    ? t('transactions_import_ofx_found').replace('{count}', String(ofxTransactions.length))
    : t('transactions_import_title')

  return (
    <Modal open={open} onClose={handleClose} title={modalTitle} size={view === 'ofx-review' ? 'lg' : 'sm'}>
      {/* Hidden file input */}
      <input
        ref={fileRef}
        type="file"
        accept=".xml,.ofx,.qfx"
        className="hidden"
        onChange={handleInputChange}
      />

      {/* Dropzone */}
      {view === 'dropzone' && (
        <div
          onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
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
                  <span className="text-xs text-[var(--text-muted)] shrink-0">{t('transactions_description')}</span>
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
              {t('transactions_cancel')}
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
        <OFXReviewTable
          transactions={ofxTransactions}
          onConfirm={handleClose}
          onCancel={reset}
        />
      )}

      {/* Error state */}
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
              {t('transactions_cancel')}
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
