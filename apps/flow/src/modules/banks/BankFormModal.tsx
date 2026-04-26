import { useEffect, useRef, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Button, Input, Modal, useToast } from '@syncero/ui'
import { useT } from '@/i18n'
import { useAuthStore } from '@/store/auth'
import { createBank, updateBank } from '@/lib/backend'
import { BRAZILIAN_BANKS } from '@/lib/brazilianBanks'
import type { Bank } from '@/types'

// ── Bank search combobox ─────────────────────────────────────

function BankCombobox({
  value,
  onChange,
}: {
  value: string
  onChange: (label: string) => void
}) {
  const t = useT()
  const [query, setQuery] = useState(value)
  const [open, setOpen] = useState(false)
  const [highlighted, setHighlighted] = useState(-1)
  const containerRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  const filtered = query.trim()
    ? BRAZILIAN_BANKS.filter((b) =>
        b.label.toLowerCase().includes(query.toLowerCase()) ||
        b.code.startsWith(query.replace(/\D/g, ''))
      )
    : BRAZILIAN_BANKS

  useEffect(() => { setQuery(value) }, [value])
  useEffect(() => { setHighlighted(-1) }, [query])

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  useEffect(() => {
    if (!listRef.current || highlighted < 0) return
    const items = listRef.current.querySelectorAll('[data-item]')
    items[highlighted]?.scrollIntoView({ block: 'nearest' })
  }, [highlighted])

  const select = (label: string) => {
    setQuery(label)
    onChange(label)
    setOpen(false)
    setHighlighted(-1)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setOpen(true)
      setHighlighted((i) => Math.min(i + 1, filtered.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlighted((i) => Math.max(i - 1, 0))
    } else if (e.key === 'Escape') {
      setOpen(false)
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (open && highlighted >= 0 && filtered[highlighted]) {
        select(filtered[highlighted].label)
      } else if (open && filtered.length === 1) {
        select(filtered[0].label)
      }
    }
  }

  return (
    <div ref={containerRef} className="relative">
      <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1.5">
        {t('banks_bank')}
      </label>
      <input
        type="text"
        value={query}
        placeholder={t('banks_searchPlaceholder')}
        autoComplete="off"
        onChange={(e) => {
          setQuery(e.target.value)
          onChange(e.target.value)
          setOpen(true)
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={handleKeyDown}
        className="w-full h-10 px-3 rounded-[var(--radius-md)] bg-[var(--bg-elevated)] border border-[var(--bg-border)] text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--accent)] transition-colors"
      />
      {open && filtered.length > 0 && (
        <div
          ref={listRef}
          className="absolute z-20 w-full mt-1 rounded-[var(--radius-md)] border border-[var(--bg-border)] bg-[var(--bg-surface)] shadow-lg overflow-hidden max-h-56 overflow-y-auto"
        >
          {filtered.map((b, i) => (
            <button
              key={b.code}
              type="button"
              data-item
              onMouseDown={(e) => { e.preventDefault(); select(b.label) }}
              className={`w-full text-left px-3 py-2.5 transition-colors hover:bg-[var(--bg-elevated)] cursor-pointer ${
                i === highlighted || b.label === value ? 'bg-[var(--bg-elevated)]' : ''
              }`}
            >
              <span className="text-sm font-mono text-[var(--accent)] mr-2">{b.code}</span>
              <span className={`text-sm ${b.label === value ? 'text-[var(--accent)]' : 'text-[var(--text-primary)]'}`}>
                {b.name}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ── BankFormModal ────────────────────────────────────────────

interface Props {
  open: boolean
  onClose: () => void
  onSaved: (bank: Bank) => void
  editing?: Bank | null
}

export function BankFormModal({ open, onClose, onSaved, editing }: Props) {
  const t = useT()
  const { success, error: toastError } = useToast()
  const qc = useQueryClient()
  const activeCompany = useAuthStore((s) => s.activeCompany)

  const [bankLabel, setBankLabel] = useState('')
  const [agency, setAgency] = useState('')
  const [accountNumber, setAccountNumber] = useState('')
  const [accountType, setAccountType] = useState<'checking' | 'savings'>('checking')

  useEffect(() => {
    if (!open) return
    if (editing) {
      setBankLabel(editing.name)
      setAgency(editing.agency ?? '')
      setAccountNumber(editing.account_number ?? '')
      setAccountType(editing.account_type)
    } else {
      setBankLabel('')
      setAgency('')
      setAccountNumber('')
      setAccountType('checking')
    }
  }, [open, editing])

  const save = useMutation({
    mutationFn: async () => {
      const payload = {
        name: bankLabel.trim(),
        agency: agency.trim() || undefined,
        account_number: accountNumber.trim() || undefined,
        account_type: accountType,
      }
      if (editing) return updateBank(editing.id, payload)
      return createBank({ company_id: activeCompany!.id, ...payload })
    },
    onSuccess: (bank) => {
      qc.invalidateQueries({ queryKey: ['banks', activeCompany?.id] })
      success(t('common_savedSuccess'))
      onSaved(bank)
    },
    onError: () => toastError(t('common_errorGeneric')),
  })

  const title = editing ? t('banks_editTitle') : t('banks_createTitle')
  const canSave = bankLabel.trim().length > 0

  return (
    <Modal open={open} onClose={onClose} title={title} size="sm">
      <div className="flex flex-col gap-4">
        <BankCombobox value={bankLabel} onChange={setBankLabel} />

        <div className="grid grid-cols-2 gap-3">
          <Input
            label={t('banks_agency')}
            value={agency}
            onChange={(e) => setAgency(e.target.value)}
            placeholder="0000"
          />
          <Input
            label={t('banks_accountNumber')}
            value={accountNumber}
            onChange={(e) => setAccountNumber(e.target.value)}
            placeholder="00000-0"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-[var(--text-muted)] mb-2">
            {t('banks_accountType')}
          </label>
          <div className="flex gap-2">
            {(['checking', 'savings'] as const).map((at) => (
              <button
                key={at}
                type="button"
                onClick={() => setAccountType(at)}
                className={`flex-1 py-1.5 rounded text-sm font-medium transition-colors cursor-pointer ${
                  accountType === at
                    ? 'bg-[var(--accent)] text-white'
                    : 'bg-[var(--bg-elevated)] text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
                }`}
              >
                {at === 'checking' ? t('banks_checking') : t('banks_savings')}
              </button>
            ))}
          </div>
        </div>

        {save.isError && (
          <p className="text-xs text-[var(--danger)]">
            {(save.error as Error)?.message}
          </p>
        )}

        <div className="flex justify-end gap-2 pt-1">
          <Button variant="ghost" onClick={onClose}>{t('settings_cancel')}</Button>
          <Button onClick={() => save.mutate()} loading={save.isPending} disabled={!canSave}>
            {t('banks_save')}
          </Button>
        </div>
      </div>
    </Modal>
  )
}
