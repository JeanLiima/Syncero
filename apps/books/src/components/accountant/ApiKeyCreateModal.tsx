import { useState } from 'react'
import { Copy, Check, Eye } from 'lucide-react'
import { Modal, Button, Input, DatePicker } from '@syncero/ui'

interface ApiKeyCreateModalProps {
  open: boolean
  onClose: () => void
  onCreate: (data: { name: string; expiresAt: string | null }) => Promise<string>
}

export function ApiKeyCreateModal({ open, onClose, onCreate }: ApiKeyCreateModalProps) {
  const [name, setName] = useState('')
  const [expiresAt, setExpiresAt] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [rawKey, setRawKey] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleCreate = async () => {
    setError(null)
    if (!name.trim()) { setError('Informe um nome para a chave.'); return }
    setSubmitting(true)
    try {
      const key = await onCreate({ name: name.trim(), expiresAt: expiresAt || null })
      setRawKey(key)
    } catch {
      setError('Erro ao criar chave. Tente novamente.')
    } finally {
      setSubmitting(false)
    }
  }

  const handleCopy = async () => {
    if (!rawKey) return
    await navigator.clipboard.writeText(rawKey)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleClose = () => {
    setName('')
    setExpiresAt('')
    setRawKey(null)
    setCopied(false)
    setError(null)
    onClose()
  }

  return (
    <Modal open={open} onClose={handleClose} title="Nova API Key" size="md">
      {rawKey ? (
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-2 p-3 rounded-[var(--radius-md)] bg-[var(--success)]/10 border border-[var(--success)]/30">
            <Eye className="h-4 w-4 text-[var(--success)] flex-shrink-0" />
            <p className="text-xs text-[var(--success)]">
              Copie esta chave agora — ela <strong>não será exibida novamente</strong>.
            </p>
          </div>
          <div className="flex items-center gap-2 p-3 rounded-[var(--radius-md)] bg-[var(--bg-elevated)] border border-[var(--bg-border)]">
            <code className="flex-1 text-xs font-mono text-[var(--text-primary)] break-all">{rawKey}</code>
            <button
              onClick={handleCopy}
              className="cursor-pointer flex items-center gap-1 px-2 py-1 rounded text-xs text-[var(--accent)] hover:bg-[var(--bg-surface)] transition-colors flex-shrink-0"
            >
              {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              {copied ? 'Copiado!' : 'Copiar'}
            </button>
          </div>
          <Button onClick={handleClose} className="self-end">Concluir</Button>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <Input
            label="Nome da chave"
            placeholder="ex: Domínio Produção"
            value={name}
            onChange={e => setName(e.target.value)}
          />
          <DatePicker
            label="Expira em (opcional)"
            value={expiresAt}
            onChange={e => setExpiresAt(e.target.value)}
          />
          {error && <p className="text-xs text-[var(--danger)]">{error}</p>}
          <div className="flex justify-end gap-2 pt-2 border-t border-[var(--bg-border)]">
            <Button variant="ghost" onClick={handleClose}>Cancelar</Button>
            <Button onClick={handleCreate} loading={submitting}>Criar chave</Button>
          </div>
        </div>
      )}
    </Modal>
  )
}
