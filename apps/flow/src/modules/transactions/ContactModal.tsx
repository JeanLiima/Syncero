import { useEffect, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Modal, Input, Button } from '@syncero/ui'
import { useT } from '@/i18n'
import { createContact } from '@/lib/backend'
import { useAuthStore } from '@syncero/auth'
import type { Contact } from '@/types'

interface ContactModalProps {
  open: boolean
  onClose: () => void
  onCreated: (contact: Contact) => void
  initialName: string
}

export function ContactModal({ open, onClose, onCreated, initialName }: ContactModalProps) {
  const t = useT()
  const qc = useQueryClient()
  const activeCompany = useAuthStore((s) => s.activeCompany)
  const [name, setName] = useState(initialName)
  const [cpf, setCpf] = useState('')
  const [cnpj, setCnpj] = useState('')

  useEffect(() => {
    if (open) {
      setName(initialName)
      setCpf('')
      setCnpj('')
    }
  }, [open])

  const save = useMutation({
    mutationFn: () => createContact({
      company_id: activeCompany!.id,
      name: name.trim(),
      cpf: cpf.trim() || undefined,
      cnpj: cnpj.trim() || undefined,
    }),
    onSuccess: (contact) => {
      qc.invalidateQueries({ queryKey: ['contacts', activeCompany?.id] })
      onCreated(contact)
    },
  })

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && name.trim() && !save.isPending) save.mutate()
  }

  return (
    <Modal open={open} onClose={onClose} title={t('contact_newTitle')} size="sm">
      <div className="flex flex-col gap-4">
        <Input
          label={t('contact_name')}
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={handleKeyDown}
          autoFocus
        />
        <div className="grid grid-cols-2 gap-3">
          <Input
            label={`${t('contact_cpf')} (${t('transactions_wizard_optional')})`}
            value={cpf}
            onChange={(e) => setCpf(e.target.value)}
            placeholder="000.000.000-00"
          />
          <Input
            label={`${t('contact_cnpj')} (${t('transactions_wizard_optional')})`}
            value={cnpj}
            onChange={(e) => setCnpj(e.target.value)}
            placeholder="00.000.000/0000-00"
          />
        </div>
      </div>
      <div className="flex items-center justify-end gap-3 mt-6 pt-4 border-t border-[var(--bg-border)]">
        <Button variant="ghost" size="sm" onClick={onClose}>
          {t('contact_cancel')}
        </Button>
        <Button
          onClick={() => save.mutate()}
          loading={save.isPending}
          disabled={!name.trim()}
        >
          {t('contact_save')}
        </Button>
      </div>
    </Modal>
  )
}