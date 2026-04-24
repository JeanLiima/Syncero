import { useState } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { format, isPast, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Plus, CheckCircle } from 'lucide-react'
import { Button, Card, Table, Badge, Modal, Input, DatePicker, Tabs, TabList, Tab, TabPanel } from '@syncero/ui'
import { usePreferencesStore } from '@/store/preferences'
import { usePayables } from '@/modules/contas/queries'
import { useCreatePayable, useMarkPayablePaid, useDeletePayable } from '@/modules/contas/mutations'
import type { PayableReceivable, PayableType } from '@/types'

const schema = z.object({
  description: z.string().min(1, 'Obrigatório'),
  amount: z.coerce.number().positive('Valor inválido'),
  due_date: z.string().min(1, 'Obrigatório'),
  contact_name: z.string().optional(),
  notes: z.string().optional(),
})

type FormData = z.infer<typeof schema>

function statusBadge(item: PayableReceivable) {
  if (item.status === 'paid') return <Badge variant="success">Pago</Badge>
  if (item.status === 'cancelled') return <Badge>Cancelado</Badge>
  if (isPast(parseISO(item.due_date))) return <Badge variant="danger">Vencido</Badge>
  return <Badge variant="warning">A vencer</Badge>
}

function PayableTable({ type }: { type: PayableType }) {
  const [modalOpen, setModalOpen] = useState(false)
  const { language } = usePreferencesStore()
  const { data = [], isLoading } = usePayables(type)
  const create = useCreatePayable()
  const markPaid = useMarkPayablePaid()
  const deleteP = useDeletePayable()

  const { register, handleSubmit, reset, control, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { due_date: format(new Date(), 'yyyy-MM-dd') },
  })

  const onSubmit = async (d: FormData) => {
    await create.mutateAsync({ ...d, type })
    reset()
    setModalOpen(false)
  }

  const total = data.filter((d) => d.status !== 'paid').reduce((s, d) => s + d.amount, 0)

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-[var(--text-muted)]">
          Total pendente:{' '}
          <span className={`font-mono font-semibold ${type === 'payable' ? 'text-[var(--danger)]' : 'text-[var(--success)]'}`}>
            {total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
          </span>
        </p>
        <Button size="sm" onClick={() => setModalOpen(true)}>
          <Plus className="h-4 w-4" /> Adicionar
        </Button>
      </div>

      <Card padding="sm">
        <Table
          loading={isLoading}
          data={data}
          rowKey={(r) => r.id}
          emptyMessage={`Nenhuma conta a ${type === 'payable' ? 'pagar' : 'receber'}`}
          columns={[
            {
              key: 'due_date',
              header: 'Vencimento',
              render: (r) => format(parseISO(r.due_date), 'dd/MM/yyyy', { locale: ptBR }),
            },
            { key: 'description', header: 'Descrição' },
            { key: 'contact_name', header: 'Contato', render: (r) => r.contact_name ?? '—' },
            {
              key: 'amount',
              header: 'Valor',
              align: 'right',
              render: (r) => (
                <span className="font-mono">
                  {r.amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </span>
              ),
            },
            { key: 'status', header: 'Status', render: statusBadge },
            {
              key: 'actions',
              header: '',
              align: 'right',
              render: (r) =>
                r.status !== 'paid' ? (
                  <div className="flex items-center gap-2 justify-end">
                    <button
                      onClick={() => markPaid.mutate({ id: r.id, type: r.type })}
                      className="p-1 text-[var(--text-muted)] hover:text-[var(--success)] transition-colors cursor-pointer"
                      title="Marcar como pago"
                    >
                      <CheckCircle className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => deleteP.mutate({ id: r.id, type: r.type })}
                      className="p-1 text-[var(--text-muted)] hover:text-[var(--danger)] transition-colors cursor-pointer"
                      title="Excluir"
                    >
                      ×
                    </button>
                  </div>
                ) : null,
            },
          ]}
        />
      </Card>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={`Nova conta a ${type === 'payable' ? 'pagar' : 'receber'}`} size="sm">
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
          <Input label="Descrição" error={errors.description?.message} {...register('description')} />
          <div className="grid grid-cols-2 gap-3">
            <Input label="Valor (R$)" type="number" step="0.01" error={errors.amount?.message} {...register('amount')} />
            <Controller
              control={control}
              name="due_date"
              render={({ field }) => (
                <DatePicker
                  label="Vencimento"
                  value={field.value ?? ''}
                  onChange={field.onChange}
                  language={language}
                  error={errors.due_date?.message}
                />
              )}
            />
          </div>
          <Input label="Contato" {...register('contact_name')} />
          <Input label="Observações" {...register('notes')} />
          <div className="flex gap-3 justify-end mt-2">
            <Button type="button" variant="ghost" onClick={() => setModalOpen(false)}>Cancelar</Button>
            <Button type="submit" loading={isSubmitting}>Salvar</Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}

export function Component() {
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-semibold text-[var(--text-primary)]">Contas</h1>

      <Tabs defaultTab="payable">
        <TabList className="mb-6">
          <Tab id="payable">A Pagar</Tab>
          <Tab id="receivable">A Receber</Tab>
        </TabList>
        <TabPanel id="payable"><PayableTable type="payable" /></TabPanel>
        <TabPanel id="receivable"><PayableTable type="receivable" /></TabPanel>
      </Tabs>
    </div>
  )
}
