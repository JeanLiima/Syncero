import { useState, useRef } from 'react'
import { Upload, AlertTriangle, CheckCircle2 } from 'lucide-react'
import { Modal, Button } from '@syncero/ui'
import { parseDominioExport, type ParsedEntry } from '@/lib/dominio'
import type { AccountPlan } from '@/types'

interface DominioImportModalProps {
  open: boolean
  onClose: () => void
  onImport: (entries: ParsedEntry[], accountsByCode: Map<string, string>) => Promise<void>
  accounts: Pick<AccountPlan, 'id' | 'code' | 'name'>[]
}

type Step = 'upload' | 'preview' | 'done'

export function DominioImportModal({ open, onClose, onImport, accounts }: DominioImportModalProps) {
  const [step, setStep] = useState<Step>('upload')
  const [entries, setEntries] = useState<ParsedEntry[]>([])
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [submitting, setSubmitting] = useState(false)
  const [importError, setImportError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const accountsByCode = new Map(accounts.map(a => [a.code, a.id]))

  const handleFile = (file: File) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      const text = e.target?.result as string
      const parsed = parseDominioExport(text)
      setEntries(parsed)
      setSelected(new Set(parsed.map((_, i) => i).filter(i => !parsed[i].parseError)))
      setStep('preview')
    }
    reader.readAsText(file, 'utf-8')
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }

  const toggleEntry = (i: number) => {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(i) ? next.delete(i) : next.add(i)
      return next
    })
  }

  const handleImport = async () => {
    setImportError(null)
    const toImport = entries.filter((_, i) => selected.has(i))
    setSubmitting(true)
    try {
      await onImport(toImport, accountsByCode)
      setStep('done')
    } catch {
      setImportError('Erro ao importar. Verifique os dados e tente novamente.')
    } finally {
      setSubmitting(false)
    }
  }

  const handleClose = () => {
    setStep('upload')
    setEntries([])
    setSelected(new Set())
    setImportError(null)
    onClose()
  }

  return (
    <Modal open={open} onClose={handleClose} title="Importar do Domínio" size="lg">
      {step === 'upload' && (
        <div className="flex flex-col gap-4">
          <p className="text-sm text-[var(--text-secondary)]">
            Exporte o arquivo de lançamentos contábeis do Domínio Contábil (formato CSV ou TXT) e faça o upload aqui.
          </p>
          <div
            onDrop={handleDrop}
            onDragOver={e => e.preventDefault()}
            onClick={() => fileRef.current?.click()}
            className="flex flex-col items-center justify-center gap-3 h-48 border-2 border-dashed border-[var(--bg-border)] rounded-[var(--radius-lg)] hover:border-[var(--accent)] cursor-pointer transition-colors"
          >
            <Upload className="h-8 w-8 text-[var(--text-muted)]" />
            <p className="text-sm text-[var(--text-secondary)]">Arraste o arquivo aqui ou clique para selecionar</p>
            <p className="text-xs text-[var(--text-muted)]">.txt, .csv</p>
            <input
              ref={fileRef}
              type="file"
              accept=".txt,.csv"
              className="hidden"
              onChange={e => { if (e.target.files?.[0]) handleFile(e.target.files[0]) }}
            />
          </div>
        </div>
      )}

      {step === 'preview' && (
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-[var(--text-secondary)]">
              {entries.length} lançamento(s) encontrado(s). {selected.size} selecionado(s) para importar.
            </p>
            <button
              className="text-xs text-[var(--accent)] hover:underline"
              onClick={() => setSelected(new Set(entries.map((_, i) => i).filter(i => !entries[i].parseError)))}
            >
              Selecionar válidos
            </button>
          </div>

          <div className="max-h-96 overflow-y-auto flex flex-col gap-2 pr-1">
            {entries.map((entry, i) => (
              <label
                key={i}
                className={`flex items-start gap-3 p-3 rounded-[var(--radius-md)] border cursor-pointer transition-colors ${
                  entry.parseError
                    ? 'border-[var(--warning)]/40 bg-[var(--warning)]/5'
                    : selected.has(i)
                    ? 'border-[var(--accent)]/40 bg-[var(--accent)]/5'
                    : 'border-[var(--bg-border)] bg-[var(--bg-elevated)]'
                }`}
              >
                <input
                  type="checkbox"
                  checked={selected.has(i)}
                  onChange={() => toggleEntry(i)}
                  disabled={entry.parseError}
                  className="mt-0.5 h-4 w-4 accent-[var(--accent)] flex-shrink-0"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-mono text-[var(--text-muted)]">{entry.entry_date}</span>
                    <span className="text-sm text-[var(--text-primary)] font-medium truncate">{entry.description}</span>
                    {entry.external_ref && (
                      <span className="text-xs text-[var(--text-muted)]">#{entry.external_ref}</span>
                    )}
                    {entry.parseError && (
                      <span className="flex items-center gap-1 text-xs text-[var(--warning)]">
                        <AlertTriangle className="h-3 w-3" /> Erro de parse
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2 mt-1">
                    {entry.lines.map((line, j) => {
                      const hasAccount = accountsByCode.has(line.account_code)
                      return (
                        <span
                          key={j}
                          className={`text-xs px-1.5 py-0.5 rounded font-mono ${
                            hasAccount ? 'bg-[var(--bg-elevated)] text-[var(--text-secondary)]' : 'bg-[var(--danger)]/15 text-[var(--danger)]'
                          }`}
                        >
                          {line.side === 'debit' ? 'D' : 'C'} {line.account_code} {!hasAccount && '⚠ não encontrada'}
                        </span>
                      )
                    })}
                  </div>
                </div>
              </label>
            ))}
          </div>

          {importError && <p className="text-xs text-[var(--danger)]">{importError}</p>}

          <div className="flex justify-end gap-2 pt-2 border-t border-[var(--bg-border)]">
            <Button variant="ghost" onClick={() => setStep('upload')}>Voltar</Button>
            <Button onClick={handleImport} loading={submitting} disabled={selected.size === 0}>
              Importar {selected.size} lançamento(s)
            </Button>
          </div>
        </div>
      )}

      {step === 'done' && (
        <div className="flex flex-col items-center gap-4 py-6">
          <CheckCircle2 className="h-12 w-12 text-[var(--success)]" />
          <p className="text-base font-semibold text-[var(--text-primary)]">Importação concluída!</p>
          <p className="text-sm text-[var(--text-muted)]">{selected.size} lançamento(s) importado(s) com sucesso.</p>
          <Button onClick={handleClose}>Fechar</Button>
        </div>
      )}
    </Modal>
  )
}
