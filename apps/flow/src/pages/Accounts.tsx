import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { format, isPast, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Plus, CheckCircle } from 'lucide-react'
import { Button, Card, Table, Badge, Modal, Input, DatePicker, Tabs, TabList, Tab, TabPanel, useToast } from '@syncero/ui'
import { usePreferencesStore } from '@/store/preferences'
import { usePayables } from '@/modules/accounts/queries'
import { useCreatePayable, useMarkPayablePaid, useDeletePayable } from '@/modules/accounts/mutations'
import { useT } from '@/i18n'
import type { PayableReceivable, PayableType } from '@/types'
import { useState } from 'react'

type FormData = {
  description: string
  amount: number
  due_date: string
  contact_name?: string
  notes?: string
}

function statusBadge(item: PayableReceivable, t: ReturnType<typeof useT>) {
  if (item.status === 'paid') return <Badge variant="success">{t('accounts_paid')}</Badge>
  if (item.status === 'cancelled') return <Badge>{t('accounts_cancelled')}</Badge>
  if (isPast(parseISO(item.due_date))) return <Badge variant="danger">{t('accounts_overdue')}</Badge>
  return <Badge variant="warning">{t('accounts_due')}</Badge>
}

function PayableTable({ type }: { type: PayableType }) {
  const t = useT()
  const { success, error: toastError } = useToast()
  const { language } = usePreferencesStore()
  const [modalOpen, setModalOpen] = useState(false)
  const { data = [], isLoading } = usePayables(type)
  const create = useCreatePayable()
  const markPaid = useMarkPayablePaid()
  const deleteP = useDeletePayable()

  const schema = z.object({
    description: z.string().min(1, t('accounts_errorRequired')),
    amount: z.coerce.number().positive(t('accounts_errorAmount')),
    due_date: z.string().min(1, t('accounts_errorRequired')),
    contact_name: z.string().optional(),
    notes: z.string().optional(),
  })

  const { register, handleSubmit, reset, control, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { due_date: format(new Date(), 'yyyy-MM-dd') },
  })

  const onSubmit = async (d: FormData) => {
    try {
      await create.mutateAsync({ ...d, type })
      reset()
      setModalOpen(false)
      success(t('common_savedSuccess'))
    } catch {
      toastError(t('common_errorGeneric'))
    }
  }

  const total = data.filter((d) => d.status !== 'paid').reduce((s, d) => s + d.amount, 0)
  const emptyMsg = type === 'payable' ? t('accounts_emptyPayable') : t('accounts_emptyReceivable')
  const modalTitle = type === 'payable' ? t('accounts_newPayable') : t('accounts_newReceivable')

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-[var(--text-muted)]">
          {t('accounts_totalPending')}{' '}
          <span className={`font-mono font-semibold ${type === 'payable' ? 'text-[var(--danger)]' : 'text-[var(--success)]'}`}>
            {total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
          </span>
        </p>
        <Button size="sm" onClick={() => setModalOpen(true)}>
          <Plus className="h-4 w-4" /> {t('accounts_add')}
        </Button>
      </div>

      <Card padding="sm">
        <Table
          loading={isLoading}
          data={data}
          rowKey={(r) => r.id}
          emptyMessage={emptyMsg}
          columns={[
            {
              key: 'due_date',
              header: t('accounts_dueDate'),
              render: (r) => format(parseISO(r.due_date), 'dd/MM/yyyy', { locale: ptBR }),
            },
            { key: 'description', header: t('accounts_description') },
            { key: 'contact_name', header: t('accounts_contact'), render: (r) => r.contact_name ?? '—' },
            {
              key: 'amount',
              header: t('accounts_amount'),
              align: 'right',
              render: (r) => (
                <span className="font-mono">
                  {r.amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </span>
              ),
            },
            { key: 'status', header: t('accounts_status'), render: (r) => statusBadge(r, t) },
            {
              key: 'actions',
              header: '',
              align: 'right',
              render: (r) =>
                r.status !== 'paid' ? (
                  <div className="flex items-center gap-2 justify-end">
                    <button
                      onClick={() => markPaid.mutate({ id: r.id, type: r.type }, { onSuccess: () => success(t('accounts_markedPaid')), onError: () => toastError(t('common_errorGeneric')) })}
                      className="p-1 text-[var(--text-muted)] hover:text-[var(--success)] transition-colors cursor-pointer"
                      title={t('accounts_markPaid')}
                    >
                      <CheckCircle className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => deleteP.mutate({ id: r.id, type: r.type }, { onSuccess: () => success(t('common_deletedSuccess')), onError: () => toastError(t('common_errorGeneric')) })}
                      className="p-1 text-[var(--text-muted)] hover:text-[var(--danger)] transition-colors cursor-pointer"
                      title={t('accounts_delete')}
                    >
                      ×
                    </button>
                  </div>
                ) : null,
            },
          ]}
        />
      </Card>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={modalTitle} size="sm">
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
          <Input label={t('accounts_description')} error={errors.description?.message} {...register('description')} />
          <div className="grid grid-cols-2 gap-3">
            <Input label={`${t('accounts_amount')} (R$)`} type="number" step="0.01" error={errors.amount?.message} {...register('amount')} />
            <Controller
              control={control}
              name="due_date"
              render={({ field }) => (
                <DatePicker
                  label={t('accounts_dueDate')}
                  value={field.value ?? ''}
                  onChange={field.onChange}
                  language={language}
                  error={errors.due_date?.message}
                />
              )}
            />
          </div>
          <Input label={t('accounts_contact')} {...register('contact_name')} />
          <Input label={t('accounts_notes')} {...register('notes')} />
          <div className="flex gap-3 justify-end mt-2">
            <Button type="button" variant="ghost" onClick={() => setModalOpen(false)}>{t('accounts_cancel')}</Button>
            <Button type="submit" loading={isSubmitting}>{t('accounts_save')}</Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}

export function Component() {
  const t = useT()

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-semibold text-[var(--text-primary)]">{t('accounts_title')}</h1>

      <Tabs defaultTab="payable">
        <TabList className="mb-6">
          <Tab id="payable">{t('accounts_payable')}</Tab>
          <Tab id="receivable">{t('accounts_receivable')}</Tab>
        </TabList>
        <TabPanel id="payable"><PayableTable type="payable" /></TabPanel>
        <TabPanel id="receivable"><PayableTable type="receivable" /></TabPanel>
      </Tabs>
    </div>
  )
}
