import { useState } from 'react'
import { Pencil, Trash2, Plus, Search } from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Button, Card, Input, Modal, Select, Table, ConfirmDialog, useToast, IconButton } from '@syncero/ui'
import { useAuthStore } from '@/store/auth'
import { useT } from '@/i18n'
import { getContacts, createContact, updateContact, deleteContact } from '@/lib/backend'
import { maskCnpj, stripCnpj, validateCnpj } from '@/lib/cnpj'
import type { Contact } from '@/types'

type DocType = 'none' | 'cpf' | 'cnpj'

interface ContactForm {
  name: string
  docType: DocType
  cpf: string
  cnpj: string
}

const emptyForm = (): ContactForm => ({ name: '', docType: 'none', cpf: '', cnpj: '' })

function fromContact(c: Contact): ContactForm {
  return {
    name: c.name,
    docType: c.cpf ? 'cpf' : c.cnpj ? 'cnpj' : 'none',
    cpf: c.cpf ?? '',
    cnpj: c.cnpj ? maskCnpj(c.cnpj) : '',
  }
}

export function Component() {
  const t = useT()
  const { success, error: toastError } = useToast()
  const activeCompany = useAuthStore((s) => s.activeCompany)
  const canWrite = activeCompany?.role !== 'viewer'
  const qc = useQueryClient()

  const [search, setSearch] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Contact | null>(null)
  const [form, setForm] = useState<ContactForm>(emptyForm())
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [cnpjError, setCnpjError] = useState('')

  const { data: contacts = [], isLoading } = useQuery<Contact[]>({
    queryKey: ['contacts', activeCompany?.id, search],
    queryFn: () => getContacts(activeCompany!.id, search || undefined),
    enabled: !!activeCompany?.id,
  })

  const openCreate = () => {
    setEditing(null)
    setForm(emptyForm())
    setCnpjError('')
    setModalOpen(true)
  }

  const openEdit = (c: Contact) => {
    setEditing(c)
    setForm(fromContact(c))
    setCnpjError('')
    setModalOpen(true)
  }

  const save = useMutation({
    mutationFn: async () => {
      const payload = {
        name: form.name.trim(),
        cpf: form.docType === 'cpf' ? form.cpf.trim() || null : null,
        cnpj: form.docType === 'cnpj' ? stripCnpj(form.cnpj) || null : null,
      }
      if (editing) return updateContact(editing.id, payload)
      return createContact({
        company_id: activeCompany!.id,
        name: payload.name,
        cpf: payload.cpf ?? undefined,
        cnpj: payload.cnpj ?? undefined,
      })
    },
    onSuccess: () => {
      setModalOpen(false)
      qc.invalidateQueries({ queryKey: ['contacts', activeCompany?.id] })
      success(t('common_savedSuccess'))
    },
    onError: () => toastError(t('common_errorGeneric')),
  })

  const remove = useMutation({
    mutationFn: (id: string) => deleteContact(id),
    onSuccess: () => {
      setDeleteId(null)
      qc.invalidateQueries({ queryKey: ['contacts', activeCompany?.id] })
      success(t('common_deletedSuccess'))
    },
    onError: () => toastError(t('common_errorGeneric')),
  })

  const canSave = form.name.trim().length > 0 && !cnpjError

  const docLabel = (c: Contact) => {
    if (c.cpf) return <span className="text-xs font-mono text-[var(--text-muted)]">{c.cpf}</span>
    if (c.cnpj) return <span className="text-xs font-mono text-[var(--text-muted)]">{maskCnpj(c.cnpj)}</span>
    return <span className="text-xs text-[var(--text-muted)]">—</span>
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-[var(--text-primary)]">{t('settings_contacts')}</h1>
        {canWrite && (
          <Button size="sm" onClick={openCreate}>
            <Plus className="h-4 w-4" />
            {t('contact_newTitle')}
          </Button>
        )}
      </div>

      <Card padding="sm">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[var(--text-muted)]" />
          <Input
            size="sm"
            placeholder={t('contact_searchPlaceholder')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8"
          />
        </div>
      </Card>

      <Card padding="sm">
        <Table
          loading={isLoading}
          data={contacts}
          rowKey={(r) => r.id}
          emptyMessage={t('contact_empty')}
          columns={[
            {
              key: 'name',
              header: t('contact_name'),
              render: (r) => <span className="text-sm font-medium text-[var(--text-primary)]">{r.name}</span>,
            },
            {
              key: 'doc',
              header: t('contact_docType'),
              render: (r) => (
                <div className="flex flex-col gap-0.5">
                  <span className="text-xs text-[var(--text-muted)]">
                    {r.cpf ? t('contact_docTypePerson') : r.cnpj ? t('contact_docTypeCompany') : t('contact_docTypeNone')}
                  </span>
                  {docLabel(r)}
                </div>
              ),
            },
            ...(canWrite ? [{
              key: 'actions',
              header: '',
              align: 'right' as const,
              className: 'w-px !px-2',
              render: (r: Contact) => (
                <div className="flex items-center justify-end gap-1">
                  <IconButton icon={<Pencil className="h-3.5 w-3.5" />} tooltip={t('categories_edit')} onClick={() => openEdit(r)} />
                  <IconButton icon={<Trash2 className="h-3.5 w-3.5" />} tooltip={t('categories_delete')} variant="danger" onClick={() => setDeleteId(r.id)} />
                </div>
              ),
            }] : []),
          ]}
        />
      </Card>

      {/* Create / Edit modal */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? t('contact_editTitle') : t('contact_newTitle')}
        size="sm"
      >
        <div className="flex flex-col gap-4">
          <Input
            label={t('contact_name')}
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            autoFocus
          />

          <Select
            label={t('contact_docType')}
            value={form.docType}
            onChange={(v) => setForm((f) => ({ ...f, docType: v as DocType, cpf: '', cnpj: '' }))}
            options={[
              { value: 'none',  label: t('contact_docTypeNone') },
              { value: 'cpf',   label: t('contact_docTypePerson') },
              { value: 'cnpj',  label: t('contact_docTypeCompany') },
            ]}
          />

          {form.docType === 'cpf' && (
            <Input
              label={t('contact_cpf')}
              value={form.cpf}
              onChange={(e) => setForm((f) => ({ ...f, cpf: e.target.value }))}
              placeholder="000.000.000-00"
              maxLength={14}
            />
          )}

          {form.docType === 'cnpj' && (
            <Input
              label={t('contact_cnpj')}
              value={form.cnpj}
              onChange={(e) => {
                const masked = maskCnpj(e.target.value)
                setForm((f) => ({ ...f, cnpj: masked }))
                setCnpjError('')
              }}
              onBlur={() => {
                if (form.cnpj && !validateCnpj(form.cnpj)) setCnpjError(t('common_cnpjInvalid'))
              }}
              placeholder="00.000.000/0000-00"
              maxLength={18}
              error={cnpjError}
            />
          )}

          {save.isError && (
            <p className="text-xs text-[var(--danger)]">
              {t('common_errorGeneric')}
            </p>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <Button variant="ghost" onClick={() => setModalOpen(false)}>{t('contact_cancel')}</Button>
            <Button onClick={() => save.mutate()} loading={save.isPending} disabled={!canSave}>
              {t('contact_save')}
            </Button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={() => remove.mutate(deleteId!)}
        title={t('contact_deleteTitle')}
        message={t('contact_deleteConfirm')}
        confirmLabel={t('categories_delete')}
        loading={remove.isPending}
      />
    </div>
  )
}
