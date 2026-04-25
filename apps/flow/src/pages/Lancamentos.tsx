import { useState } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Plus, CheckCircle } from 'lucide-react'
import { Button, Card, Table, Badge, Modal, Input, Select, DatePicker, Checkbox } from '@syncero/ui'
import { usePreferencesStore } from '@/store/preferences'
import { useTransactions, useCategories } from '@/modules/lancamentos/queries'
import { useCreateTransaction, useUpdateTransaction, useMarkAsPaid, useDeleteTransaction } from '@/modules/lancamentos/mutations'
import { useT } from '@/i18n'
import type { Transaction } from '@/types'
import type { TransactionFilters } from '@/modules/lancamentos/types'

export function Component() {
  const t = useT()
  const { language } = usePreferencesStore()

  const schema = z.object({
    description: z.string().min(1, t('transactions_errorDescription')),
    amount: z.coerce.number().positive(t('transactions_errorAmount')),
    type: z.enum(['income', 'expense']),
    date: z.string().min(1, t('transactions_errorDate')),
    category_id: z.string().optional(),
    is_paid: z.boolean(),
    notes: z.string().optional(),
  })

  type FormData = z.infer<typeof schema>

  const [filters, setFilters] = useState<TransactionFilters>({})
  const [page, setPage] = useState(1)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Transaction | null>(null)

  const { data, isLoading } = useTransactions(filters, page)
  const { data: categories = [] } = useCategories()
  const create = useCreateTransaction()
  const update = useUpdateTransaction()
  const markPaid = useMarkAsPaid()
  const deleteT = useDeleteTransaction()

  const {
    register,
    handleSubmit,
    reset,
    control,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { type: 'expense', is_paid: false, date: format(new Date(), 'yyyy-MM-dd') },
  })

  const openCreate = () => {
    setEditing(null)
    reset({ type: 'expense', is_paid: false, date: format(new Date(), 'yyyy-MM-dd') })
    setModalOpen(true)
  }

  const openEdit = (t: Transaction) => {
    setEditing(t)
    reset({
      description: t.description,
      amount: t.amount,
      type: t.type,
      date: t.date,
      category_id: t.category_id ?? undefined,
      is_paid: t.is_paid,
      notes: t.notes ?? undefined,
    })
    setModalOpen(true)
  }

  const onSubmit = async (data: FormData) => {
    if (editing) {
      await update.mutateAsync({ id: editing.id, data })
    } else {
      await create.mutateAsync(data)
    }
    setModalOpen(false)
    reset()
  }

  const totalPages = Math.ceil((data?.count ?? 0) / 20)
  const categoryOptions = categories.map((c) => ({ value: c.id, label: c.name }))

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-[var(--text-primary)]">{t('transactions_title')}</h1>
          <p className="text-sm text-[var(--text-muted)]">
            {data?.count ?? 0} {(data?.count ?? 0) !== 1 ? t('transactions_countPlural') : t('transactions_countSingular')}
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4" /> {t('transactions_new')}
        </Button>
      </div>

      {/* Filters */}
      <Card padding="sm">
        <div className="flex flex-wrap gap-3">
          <Select
            options={[
              { value: '', label: t('transactions_allTypes') },
              { value: 'income', label: t('transactions_income') },
              { value: 'expense', label: t('transactions_expense') },
            ]}
            value={filters.type ?? ''}
            onChange={(v) => setFilters((f) => ({ ...f, type: v as TransactionFilters['type'] || undefined }))}
            className="w-40"
          />
          <Select
            options={[
              { value: '', label: t('transactions_allStatus') },
              { value: 'true', label: t('transactions_paid') },
              { value: 'false', label: t('transactions_pending') },
            ]}
            value={filters.is_paid === undefined ? '' : String(filters.is_paid)}
            onChange={(v) => setFilters((f) => ({ ...f, is_paid: v === '' ? undefined : v === 'true' }))}
            className="w-44"
          />
          <DatePicker
            value={filters.date_from ?? ''}
            onChange={(v) => setFilters((f) => ({ ...f, date_from: v || undefined }))}
            language={language}
            className="w-40"
          />
          <DatePicker
            value={filters.date_to ?? ''}
            onChange={(v) => setFilters((f) => ({ ...f, date_to: v || undefined }))}
            language={language}
            className="w-40"
          />
        </div>
      </Card>

      {/* Table */}
      <Card padding="sm">
        <Table
          loading={isLoading}
          data={data?.data ?? []}
          rowKey={(r) => r.id}
          onRowClick={openEdit}
          loadingMessage={t('common_loading')}
          emptyMessage={t('transactions_empty')}
          columns={[
            {
              key: 'date',
              header: t('transactions_date'),
              render: (r) => format(new Date(r.date + 'T00:00:00'), 'dd/MM/yyyy', { locale: ptBR }),
            },
            { key: 'description', header: t('transactions_description') },
            {
              key: 'type',
              header: t('transactions_type'),
              render: (r) => (
                <Badge variant={r.type === 'income' ? 'success' : 'danger'}>
                  {r.type === 'income' ? t('transactions_income_badge') : t('transactions_expense_badge')}
                </Badge>
              ),
            },
            {
              key: 'amount',
              header: t('transactions_amount'),
              align: 'right',
              render: (r) => (
                <span className={r.type === 'income' ? 'text-[var(--success)] font-mono' : 'text-[var(--danger)] font-mono'}>
                  {r.type === 'income' ? '+' : '-'}{' '}
                  {r.amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </span>
              ),
            },
            {
              key: 'is_paid',
              header: t('transactions_status'),
              render: (r) => (
                <Badge variant={r.is_paid ? 'success' : 'warning'}>
                  {r.is_paid ? t('transactions_paid') : t('transactions_pending')}
                </Badge>
              ),
            },
            {
              key: 'actions',
              header: '',
              align: 'right',
              render: (r) =>
                !r.is_paid ? (
                  <button
                    onClick={(e) => { e.stopPropagation(); markPaid.mutate(r.id) }}
                    className="p-1 text-[var(--text-muted)] hover:text-[var(--success)] transition-colors cursor-pointer"
                    title={t('transactions_markAsPaid')}
                  >
                    <CheckCircle className="h-4 w-4" />
                  </button>
                ) : null,
            },
          ]}
        />

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-[var(--bg-border)]">
            <span className="text-xs text-[var(--text-muted)]">
              {t('dre_period')} {page} / {totalPages}
            </span>
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" disabled={page === 1} onClick={() => setPage((p) => p - 1)}>
                {t('transactions_previous')}
              </Button>
              <Button variant="ghost" size="sm" disabled={page === totalPages} onClick={() => setPage((p) => p + 1)}>
                {t('transactions_next')}
              </Button>
            </div>
          </div>
        )}
      </Card>

      {/* Modal form */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? t('transactions_editTitle') : t('transactions_newTitle')}>
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
          <Input label={t('transactions_description')} error={errors.description?.message} {...register('description')} />
          <div className="grid grid-cols-2 gap-3">
            <Input label={`${t('transactions_amount')} (R$)`} type="number" step="0.01" error={errors.amount?.message} {...register('amount')} />
            <Controller
              control={control}
              name="date"
              render={({ field }) => (
                <DatePicker
                  label={t('transactions_date')}
                  value={field.value ?? ''}
                  onChange={field.onChange}
                  language={language}
                  error={errors.date?.message}
                />
              )}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Controller
              control={control}
              name="type"
              render={({ field }) => (
                <Select
                  label={t('transactions_type')}
                  value={field.value ?? ''}
                  onChange={field.onChange}
                  onBlur={field.onBlur}
                  error={errors.type?.message}
                  options={[
                    { value: 'income',  label: t('transactions_income_badge') },
                    { value: 'expense', label: t('transactions_expense_badge') },
                  ]}
                />
              )}
            />
            <Controller
              control={control}
              name="category_id"
              render={({ field }) => (
                <Select
                  label={t('transactions_category')}
                  placeholder={t('transactions_noCategory')}
                  value={field.value ?? ''}
                  onChange={(v) => field.onChange(v || undefined)}
                  onBlur={field.onBlur}
                  options={categoryOptions}
                />
              )}
            />
          </div>
          <Input label={t('transactions_notes')} {...register('notes')} />
          <Checkbox label={t('transactions_markAsPaid')} {...register('is_paid')} />
          <div className="flex justify-between gap-3 mt-2">
            {editing && (
              <Button
                type="button"
                variant="danger"
                size="sm"
                onClick={async () => { await deleteT.mutateAsync(editing.id); setModalOpen(false) }}
              >
                {t('transactions_delete')}
              </Button>
            )}
            <div className="flex gap-3 ml-auto">
              <Button type="button" variant="ghost" onClick={() => setModalOpen(false)}>{t('transactions_cancel')}</Button>
              <Button type="submit" loading={isSubmitting}>{t('transactions_save')}</Button>
            </div>
          </div>
        </form>
      </Modal>
    </div>
  )
}
