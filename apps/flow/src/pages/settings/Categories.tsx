import { useState } from 'react'
import { Pencil, Trash2, Plus, Search } from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Button, Card, ColorPicker, COLORS, Input, Modal, Select, Table, Badge, useToast, IconButton } from '@syncero/ui'
import { useAuthStore } from '@/store/auth'
import { useT } from '@/i18n'
import { getCategories, getCategoryUsage, createCategory, updateCategory, deleteCategory } from '@/lib/backend'
import type { Category, TransactionType } from '@/types'


type CategoryForm = { name: string; type: TransactionType; color: string }
type EditModal = { editing: Category | null; form: CategoryForm }
type DeleteModal = { category: Category; usageCount: number | null; transferTo: string }

export function Component() {
  const t = useT()
  const { success, error: toastError } = useToast()
  const activeCompany = useAuthStore((s) => s.activeCompany)
  const canWrite = activeCompany?.role !== 'viewer'
  const qc = useQueryClient()

  const [nameFilter, setNameFilter] = useState('')
  const [typeFilter, setTypeFilter] = useState<'all' | TransactionType>('all')
  const [editModal, setEditModal] = useState<EditModal | null>(null)
  const [deleteModal, setDeleteModal] = useState<DeleteModal | null>(null)

  const setForm = (updater: (f: CategoryForm) => CategoryForm) =>
    setEditModal((m) => m && { ...m, form: updater(m.form) })

  const { data: categories = [], isLoading } = useQuery<Category[]>({
    queryKey: ['categories', activeCompany?.id],
    queryFn: () => getCategories(activeCompany!.id),
    enabled: !!activeCompany?.id,
  })

  const filtered = categories.filter((c) => {
    if (typeFilter !== 'all' && c.type !== typeFilter) return false
    if (nameFilter.trim() && !c.name.toLowerCase().includes(nameFilter.toLowerCase())) return false
    return true
  })

  const openCreate = () =>
    setEditModal({ editing: null, form: { name: '', type: 'income', color: COLORS[0] } })

  const openEdit = (cat: Category) =>
    setEditModal({ editing: cat, form: { name: cat.name, type: cat.type, color: cat.color ?? COLORS[0] } })

  const openDelete = async (cat: Category) => {
    setDeleteModal({ category: cat, usageCount: null, transferTo: '' })
    const { count } = await getCategoryUsage(cat.id)
    setDeleteModal((prev) => prev && { ...prev, usageCount: count })
  }

  const save = useMutation({
    mutationFn: async () => {
      const { editing, form } = editModal!
      if (editing) return updateCategory(editing.id, form)
      return createCategory({ company_id: activeCompany!.id, ...form })
    },
    onSuccess: () => {
      setEditModal(null)
      qc.invalidateQueries({ queryKey: ['categories', activeCompany?.id] })
      success(t('common_savedSuccess'))
    },
    onError: () => toastError(t('common_errorGeneric')),
  })

  const remove = useMutation({
    mutationFn: async () =>
      deleteCategory(deleteModal!.category.id, deleteModal!.transferTo || null),
    onSuccess: () => {
      setDeleteModal(null)
      qc.invalidateQueries({ queryKey: ['categories', activeCompany?.id] })
      success(t('common_deletedSuccess'))
    },
    onError: () => toastError(t('common_errorGeneric')),
  })

  const otherCategories = categories.filter(
    (c) => c.id !== deleteModal?.category.id && c.type === deleteModal?.category.type,
  )

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-[var(--text-primary)]">{t('settings_categories')}</h1>
        {canWrite && (
          <Button size="sm" onClick={openCreate}>
            <Plus className="h-4 w-4" />
            {t('categories_new')}
          </Button>
        )}
      </div>

      <Card padding="sm">
        <div className="flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-40">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[var(--text-muted)]" />
            <Input
              size="sm"
              placeholder={t('categories_searchPlaceholder')}
              value={nameFilter}
              onChange={(e) => setNameFilter(e.target.value)}
              className="pl-8"
            />
          </div>
          <Select
            size="sm"
            options={[
              { value: 'all',     label: t('categories_all') },
              { value: 'income',  label: t('categories_income') },
              { value: 'expense', label: t('categories_expense') },
            ]}
            value={typeFilter}
            onChange={(v) => setTypeFilter(v as 'all' | TransactionType)}
            className="w-40"
          />
        </div>
      </Card>

      <Card padding="sm">
        <Table
          loading={isLoading}
          data={filtered}
          rowKey={(r) => r.id}
          emptyMessage={t('categories_empty')}
          columns={[
            {
              key: 'color',
              header: '',
              className: 'w-px !px-3',
              render: (r) => (
                <div className="h-3 w-3 rounded-full" style={{ backgroundColor: r.color ?? '#94a3b8' }} />
              ),
            },
            {
              key: 'name',
              header: t('categories_name'),
              render: (r) => <span className="text-sm text-[var(--text-primary)]">{r.name}</span>,
            },
            {
              key: 'type',
              header: t('categories_type'),
              render: (r) => (
                <Badge variant={r.type === 'income' ? 'success' : 'danger'}>
                  {r.type === 'income' ? t('categories_income') : t('categories_expense')}
                </Badge>
              ),
            },
            ...(canWrite ? [{
              key: 'actions',
              header: '',
              align: 'right' as const,
              className: 'w-px !px-2',
              render: (r: Category) => (
                <div className="flex items-center justify-end gap-1">
                  <IconButton icon={<Pencil className="h-3.5 w-3.5" />} tooltip={t('categories_edit')} onClick={() => openEdit(r)} />
                  <IconButton icon={<Trash2 className="h-3.5 w-3.5" />} tooltip={t('categories_delete')} variant="danger" onClick={() => openDelete(r)} />
                </div>
              ),
            }] : []),
          ]}
        />
      </Card>

      {/* Create / Edit modal */}
      <Modal
        open={!!editModal}
        onClose={() => setEditModal(null)}
        title={editModal?.editing ? t('categories_editTitle') : t('categories_createTitle')}
        size="sm"
      >
        <div className="flex flex-col gap-4">
          <Input
            label={t('categories_name')}
            value={editModal?.form.name ?? ''}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          />
          <div>
            <label className="block text-xs font-medium text-[var(--text-muted)] mb-2">{t('categories_type')}</label>
            <div className="flex gap-2">
              {(['income', 'expense'] as const).map((t_) => (
                <button
                  key={t_}
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, type: t_ }))}
                  className={`flex-1 py-1.5 rounded text-sm font-medium transition-colors cursor-pointer ${
                    editModal?.form.type === t_
                      ? t_ === 'income'
                        ? 'bg-[var(--success)] text-white'
                        : 'bg-[var(--danger)] text-white'
                      : 'bg-[var(--bg-elevated)] text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
                  }`}
                >
                  {t_ === 'income' ? t('categories_income') : t('categories_expense')}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-[var(--text-muted)] mb-2">{t('categories_color')}</label>
            <ColorPicker value={editModal?.form.color ?? null} onChange={(c) => setForm((f) => ({ ...f, color: c }))} />
          </div>
          {save.isError && (
            <p className="text-xs text-[var(--danger)]">
              {(save.error as Error)?.message ?? t('categories_saveError')}
            </p>
          )}
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="ghost" onClick={() => setEditModal(null)}>{t('settings_cancel')}</Button>
            <Button onClick={() => save.mutate()} loading={save.isPending} disabled={!editModal?.form.name.trim()}>
              {t('categories_save')}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Delete confirm dialog */}
      <Modal
        open={!!deleteModal}
        onClose={() => setDeleteModal(null)}
        title={t('categories_deleteTitle')}
        size="sm"
      >
        {deleteModal?.usageCount === null ? (
          <div className="flex justify-center py-4">
            <div className="h-5 w-5 border-2 border-[var(--accent)] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {(deleteModal?.usageCount ?? 0) > 0 ? (
              <>
                <p className="text-sm text-[var(--text-secondary)]">
                  {t('categories_deleteUsed').replace('{count}', String(deleteModal?.usageCount))}
                </p>
                <Select
                  label={t('categories_transferTo')}
                  placeholder={t('categories_transferNone')}
                  value={deleteModal?.transferTo ?? ''}
                  onChange={(v) => setDeleteModal((m) => m && { ...m, transferTo: v })}
                  options={otherCategories.map((c) => ({ value: c.id, label: c.name }))}
                />
              </>
            ) : (
              <p className="text-sm text-[var(--text-secondary)]">{t('categories_deleteConfirm')}</p>
            )}
            {remove.isError && (
              <p className="text-xs text-[var(--danger)]">
                {(remove.error as Error)?.message ?? t('categories_deleteError')}
              </p>
            )}
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setDeleteModal(null)}>{t('settings_cancel')}</Button>
              <Button variant="danger" onClick={() => remove.mutate()} loading={remove.isPending}>
                {t('categories_delete')}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
