import { useState } from 'react'
import { Pencil, Trash2, Plus } from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Button, Card, Table, ConfirmDialog, useToast, IconButton } from '@syncero/ui'
import { useAuthStore } from '@/store/auth'
import { useT } from '@/i18n'
import { getBanks, deleteBank } from '@/lib/backend'
import { BankFormModal } from '@/modules/banks/BankFormModal'
import type { Bank } from '@/types'

export function Component() {
  const t = useT()
  const { success, error: toastError } = useToast()
  const activeCompany = useAuthStore((s) => s.activeCompany)
  const canWrite = activeCompany?.role !== 'viewer'
  const qc = useQueryClient()

  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Bank | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)

  const { data: banks = [], isLoading } = useQuery<Bank[]>({
    queryKey: ['banks', activeCompany?.id],
    queryFn: () => getBanks(activeCompany!.id),
    enabled: !!activeCompany?.id,
  })

  const openCreate = () => { setEditing(null); setModalOpen(true) }
  const openEdit = (b: Bank) => { setEditing(b); setModalOpen(true) }

  const remove = useMutation({
    mutationFn: (id: string) => deleteBank(id),
    onSuccess: () => {
      setDeleteId(null)
      qc.invalidateQueries({ queryKey: ['banks', activeCompany?.id] })
      success(t('common_deletedSuccess'))
    },
    onError: () => toastError(t('common_errorGeneric')),
  })

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-[var(--text-primary)]">{t('settings_banks')}</h1>
        {canWrite && (
          <Button size="sm" onClick={openCreate}>
            <Plus className="h-4 w-4" />
            {t('banks_new')}
          </Button>
        )}
      </div>

      <Card padding="sm">
        <Table
          loading={isLoading}
          data={banks}
          rowKey={(r) => r.id}
          emptyMessage={t('banks_empty')}
          columns={[
            {
              key: 'name',
              header: t('banks_name'),
              render: (r) => <span className="text-sm font-medium text-[var(--text-primary)]">{r.name}</span>,
            },
            {
              key: 'agency',
              header: t('banks_agency'),
              render: (r) => <span className="text-sm text-[var(--text-secondary)]">{r.agency ?? '—'}</span>,
            },
            {
              key: 'account_number',
              header: t('banks_accountNumber'),
              render: (r) => <span className="text-sm text-[var(--text-secondary)]">{r.account_number ?? '—'}</span>,
            },
            {
              key: 'account_type',
              header: t('banks_accountType'),
              render: (r) => (
                <span className="text-sm text-[var(--text-secondary)]">
                  {r.account_type === 'checking' ? t('banks_checking') : t('banks_savings')}
                </span>
              ),
            },
            ...(canWrite ? [{
              key: 'actions',
              header: '',
              align: 'right' as const,
              className: 'w-px !px-2',
              render: (r: Bank) => (
                <div className="flex items-center justify-end gap-1">
                  <IconButton icon={<Pencil className="h-3.5 w-3.5" />} tooltip={t('categories_edit')} onClick={() => openEdit(r)} />
                  <IconButton icon={<Trash2 className="h-3.5 w-3.5" />} tooltip={t('categories_delete')} variant="danger" onClick={() => setDeleteId(r.id)} />
                </div>
              ),
            }] : []),
          ]}
        />
      </Card>

      <BankFormModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        editing={editing}
        onSaved={() => setModalOpen(false)}
      />

      <ConfirmDialog
        open={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={() => remove.mutate(deleteId!)}
        title={t('banks_deleteTitle')}
        message={t('banks_deleteConfirm')}
        confirmLabel={t('categories_delete')}
        loading={remove.isPending}
      />
    </div>
  )
}
