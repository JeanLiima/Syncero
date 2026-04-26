import { useState } from 'react'
import { Pencil, Trash2, Plus } from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Button, Card, Input, Modal, Select, Table, Badge, useToast } from '@syncero/ui'
import { useAuthStore } from '@/store/auth'
import { useT } from '@/i18n'
import { getCategories, getCategoryUsage, createCategory, updateCategory, deleteCategory } from '@/lib/backend'
import type { Category, TransactionType } from '@/types'

const COLORS = [
  '#10b981', '#3b82f6', '#f43f5e', '#f59e0b',
  '#8b5cf6', '#ec4899', '#6366f1', '#14b8a6',
  '#ef4444', '#fb923c', '#94a3b8', '#a78bfa',
]

function ColorPicker({ value, onChange }: { value: string | null; onChange: (c: string) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {COLORS.map((c) => (
        <button
          key={c}
          type="button"
          onClick={() => onChange(c)}
          className="h-6 w-6 rounded-full border-2 transition-transform hover:scale-110 cursor-pointer"
          style={{
            backgroundColor: c,
            borderColor: value === c ? 'white' : 'transparent',
            boxShadow: value === c ? `0 0 0 2px ${c}` : undefined,
          }}
        />
      ))}
    </div>
  )
}

type CategoryForm = { name: string; type: TransactionType; color: string }

export function Component() {
  const t = useT()
  const { success, error: toastError } = useToast()
  const activeCompany = useAuthStore((s) => s.activeCompany)
  const qc = useQueryClient()

  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Category | null>(null)
  const [form, setForm] = useState<CategoryForm>({ name: '', type: 'income', color: COLORS[0] })
  const [typeFilter, setTypeFilter] = useState<'all' | TransactionType>('all')

  const [deleting, setDeleting] = useState<Category | null>(null)
  const [usageCount, setUsageCount] = useState<number | null>(null)
  const [transferTo, setTransferTo] = useState<string>('')

  const { data: categories = [], isLoading } = useQuery<Category[]>({
    queryKey: ['categories', activeCompany?.id],
    queryFn: () => getCategories(activeCompany!.id),
    enabled: !!activeCompany?.id,
  })

  const filtered = typeFilter === 'all' ? categories : categories.filter((c) => c.type === typeFilter)

  const openCreate = () => {
    setEditing(null)
    setForm({ name: '', type: 'income', color: COLORS[0] })
    setModalOpen(true)
  }

  const openEdit = (cat: Category) => {
    setEditing(cat)
    setForm({ name: cat.name, type: cat.type, color: cat.color ?? COLORS[0] })
    setModalOpen(true)
  }

  const openDelete = async (cat: Category) => {
    setDeleting(cat)
    setUsageCount(null)
    setTransferTo('')
    const { count } = await getCategoryUsage(cat.id)
    setUsageCount(count)
  }

  const save = useMutation({
    mutationFn: async () => {
      if (editing) return updateCategory(editing.id, form)
      return createCategory({ company_id: activeCompany!.id, ...form })
    },
    onSuccess: () => {
      setModalOpen(false)
      qc.invalidateQueries({ queryKey: ['categories', activeCompany?.id] })
      success(t('common_savedSuccess'))
    },
    onError: () => toastError(t('common_errorGeneric')),
  })

  const remove = useMutation({
    mutationFn: async () => {
      const to = transferTo || null
      return deleteCategory(deleting!.id, to)
    },
    onSuccess: () => {
      setDeleting(null)
      qc.invalidateQueries({ queryKey: ['categories', activeCompany?.id] })
      success(t('common_deletedSuccess'))
    },
    onError: () => toastError(t('common_errorGeneric')),
  })

  const otherCategories = categories.filter(
    (c) => c.id !== deleting?.id && c.type === deleting?.type,
  )

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold text-[var(--text-primary)]">{t('settings_categories')}</h1>

      <div className="flex items-center justify-between gap-4">
        <div className="flex gap-1">
          {(['all', 'income', 'expense'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setTypeFilter(f)}
              className={`cursor-pointer px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                typeFilter === f
                  ? 'bg-[var(--accent)] text-white'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)]'
              }`}
            >
              {f === 'all' ? t('categories_all') : f === 'income' ? t('categories_income') : t('categories_expense')}
            </button>
          ))}
        </div>
        <Button size="sm" onClick={openCreate}>
          <Plus className="h-4 w-4" />
          {t('categories_new')}
        </Button>
      </div>

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
            {
              key: 'actions',
              header: '',
              align: 'right',
              className: 'w-px !px-2',
              render: (r) => (
                <div className="flex items-center justify-end gap-1">
                  <div className="relative group">
                    <button
                      onClick={() => openEdit(r)}
                      className="cursor-pointer p-1.5 rounded hover:bg-[var(--bg-border)] text-[var(--text-muted)] hover:text-[var(--accent)] transition-colors"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <span className="pointer-events-none absolute -top-8 right-0 whitespace-nowrap rounded px-2 py-1 text-xs bg-[var(--bg-elevated)] border border-[var(--bg-border)] text-[var(--text-secondary)] opacity-0 group-hover:opacity-100 transition-opacity z-10">
                      {t('categories_edit')}
                    </span>
                  </div>
                  <div className="relative group">
                    <button
                      onClick={() => openDelete(r)}
                      className="cursor-pointer p-1.5 rounded hover:bg-[var(--bg-border)] text-[var(--text-muted)] hover:text-[var(--danger)] transition-colors"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                    <span className="pointer-events-none absolute -top-8 right-0 whitespace-nowrap rounded px-2 py-1 text-xs bg-[var(--bg-elevated)] border border-[var(--bg-border)] text-[var(--text-secondary)] opacity-0 group-hover:opacity-100 transition-opacity z-10">
                      {t('categories_delete')}
                    </span>
                  </div>
                </div>
              ),
            },
          ]}
        />
      </Card>

      {/* Create / Edit modal */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? t('categories_editTitle') : t('categories_createTitle')}
        size="sm"
      >
        <div className="flex flex-col gap-4">
          <Input
            label={t('categories_name')}
            value={form.name}
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
                    form.type === t_
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
            <ColorPicker value={form.color} onChange={(c) => setForm((f) => ({ ...f, color: c }))} />
          </div>
          {save.isError && (
            <p className="text-xs text-[var(--danger)]">
              {(save.error as Error)?.message ?? t('categories_saveError')}
            </p>
          )}
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="ghost" onClick={() => setModalOpen(false)}>{t('settings_cancel')}</Button>
            <Button onClick={() => save.mutate()} loading={save.isPending} disabled={!form.name.trim()}>
              {t('categories_save')}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Delete confirm dialog */}
      <Modal
        open={!!deleting}
        onClose={() => setDeleting(null)}
        title={t('categories_deleteTitle')}
        size="sm"
      >
        {usageCount === null ? (
          <div className="flex justify-center py-4">
            <div className="h-5 w-5 border-2 border-[var(--accent)] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {usageCount > 0 ? (
              <>
                <p className="text-sm text-[var(--text-secondary)]">
                  {t('categories_deleteUsed').replace('{count}', String(usageCount))}
                </p>
                <Select
                  label={t('categories_transferTo')}
                  placeholder={t('categories_transferNone')}
                  value={transferTo}
                  onChange={setTransferTo}
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
              <Button variant="ghost" onClick={() => setDeleting(null)}>{t('settings_cancel')}</Button>
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
