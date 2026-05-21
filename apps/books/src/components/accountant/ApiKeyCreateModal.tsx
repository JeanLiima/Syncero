import { useState } from 'react'
import { Copy, Check, Eye } from 'lucide-react'
import { AlertBox, Modal, Button, Input, DatePicker } from '@syncero/ui'
import { usePreferencesStore } from '@/store/preferences'
import { useT } from '@/i18n'

interface ApiKeyCreateModalProps {
  open: boolean
  onClose: () => void
  onCreate: (data: { name: string; expiresAt: string | null }) => Promise<string>
}

export function ApiKeyCreateModal({ open, onClose, onCreate }: ApiKeyCreateModalProps) {
  const t = useT()
  const language = usePreferencesStore(s => s.language)
  const [name, setName] = useState('')
  const [expiresAt, setExpiresAt] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [rawKey, setRawKey] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleCreate = async () => {
    setError(null)
    if (!name.trim()) { setError(t('apiKeys_errorName')); return }
    setSubmitting(true)
    try {
      const key = await onCreate({ name: name.trim(), expiresAt: expiresAt || null })
      setRawKey(key)
    } catch {
      setError(t('apiKeys_errorCreate'))
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
    <Modal open={open} onClose={handleClose} title={t('apiKeys_new')} size="md">
      {rawKey ? (
        <div className="flex flex-col gap-4">
          <AlertBox variant="success" icon={<Eye className="h-4 w-4" />}>
            <span className="text-[var(--success)]">{t('apiKeys_warningOnce')}</span>
          </AlertBox>
          <div className="flex items-center gap-2 p-3 rounded-[var(--radius-md)] bg-[var(--bg-elevated)] border border-[var(--bg-border)]">
            <code className="flex-1 text-xs font-mono text-[var(--text-primary)] break-all">{rawKey}</code>
            <button
              onClick={handleCopy}
              className="cursor-pointer flex items-center gap-1 px-2 py-1 rounded text-xs text-[var(--accent)] hover:bg-[var(--bg-surface)] transition-colors flex-shrink-0"
            >
              {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              {copied ? t('apiKeys_copied') : t('apiKeys_copy')}
            </button>
          </div>
          <Button onClick={handleClose} className="self-end">{t('apiKeys_done')}</Button>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <Input
            label={t('apiKeys_fieldName')}
            placeholder={t('apiKeys_namePlaceholder')}
            value={name}
            onChange={e => setName(e.target.value)}
          />
          <DatePicker
            label={t('apiKeys_fieldExpiry')}
            value={expiresAt}
            onChange={setExpiresAt}
            language={language}
          />
          {error && <p className="text-xs text-[var(--danger)]">{error}</p>}
          <div className="flex justify-end gap-2 pt-2 border-t border-[var(--bg-border)]">
            <Button variant="ghost" onClick={handleClose}>{t('settings_cancel')}</Button>
            <Button onClick={handleCreate} loading={submitting}>{t('apiKeys_createKey')}</Button>
          </div>
        </div>
      )}
    </Modal>
  )
}
