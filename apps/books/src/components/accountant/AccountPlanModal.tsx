import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Modal, Button, Input, Select } from '@syncero/ui'
import type { AccountPlan, AccountType, AccountNature } from '@/types'

const schema = z.object({
  code: z.string().min(1, 'Obrigatório').regex(/^[\d.]+$/, 'Apenas dígitos e pontos'),
  name: z.string().min(1, 'Obrigatório'),
  account_type: z.enum(['ativo', 'passivo', 'patrimonio_liquido', 'receita', 'despesa', 'custo']),
  nature: z.enum(['devedora', 'credora']),
  is_analytic: z.boolean(),
  parent_id: z.string().nullable(),
})

type FormData = z.infer<typeof schema>

interface AccountPlanModalProps {
  open: boolean
  onClose: () => void
  onSubmit: (data: FormData) => Promise<void>
  parents: Pick<AccountPlan, 'id' | 'code' | 'name'>[]
  editing?: AccountPlan | null
}

const accountTypeOptions: { value: AccountType; label: string }[] = [
  { value: 'ativo', label: 'Ativo' },
  { value: 'passivo', label: 'Passivo' },
  { value: 'patrimonio_liquido', label: 'Patrimônio Líquido' },
  { value: 'receita', label: 'Receita' },
  { value: 'despesa', label: 'Despesa' },
  { value: 'custo', label: 'Custo' },
]

const natureOptions: { value: AccountNature; label: string }[] = [
  { value: 'devedora', label: 'Devedora' },
  { value: 'credora', label: 'Credora' },
]

const defaultNature: Record<AccountType, AccountNature> = {
  ativo: 'devedora',
  despesa: 'devedora',
  custo: 'devedora',
  passivo: 'credora',
  patrimonio_liquido: 'credora',
  receita: 'credora',
}

export function AccountPlanModal({ open, onClose, onSubmit, parents, editing }: AccountPlanModalProps) {
  const { register, handleSubmit, watch, setValue, reset, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      code: '',
      name: '',
      account_type: 'ativo',
      nature: 'devedora',
      is_analytic: true,
      parent_id: null,
    },
  })

  useEffect(() => {
    if (editing) {
      reset({
        code: editing.code,
        name: editing.name,
        account_type: editing.account_type,
        nature: editing.nature,
        is_analytic: editing.is_analytic,
        parent_id: editing.parent_id,
      })
    } else {
      reset({ code: '', name: '', account_type: 'ativo', nature: 'devedora', is_analytic: true, parent_id: null })
    }
  }, [editing, open, reset])

  const accountType = watch('account_type')

  useEffect(() => {
    setValue('nature', defaultNature[accountType as AccountType])
  }, [accountType, setValue])

  const parentOptions = [
    { value: '', label: '— Raiz (sem pai) —' },
    ...parents.map(p => ({ value: p.id, label: `${p.code} — ${p.name}` })),
  ]

  const handleFormSubmit = handleSubmit(async (data) => {
    await onSubmit({ ...data, parent_id: data.parent_id || null })
    onClose()
  })

  return (
    <Modal open={open} onClose={onClose} title={editing ? 'Editar conta' : 'Nova conta'} size="md">
      <form onSubmit={handleFormSubmit} className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-4">
          <Input
            label="Código"
            placeholder="ex: 1.1.1.01"
            error={errors.code?.message}
            {...register('code')}
          />
          <Input
            label="Nome"
            placeholder="ex: Caixa"
            error={errors.name?.message}
            {...register('name')}
          />
        </div>

        <Select
          label="Conta pai"
          options={parentOptions}
          value={watch('parent_id') ?? ''}
          onChange={(v) => setValue('parent_id', v || null)}
        />

        <div className="grid grid-cols-2 gap-4">
          <Select
            label="Tipo"
            options={accountTypeOptions}
            value={watch('account_type')}
            onChange={(v) => setValue('account_type', v as AccountType)}
          />
          <Select
            label="Natureza"
            options={natureOptions}
            value={watch('nature')}
            onChange={(v) => setValue('nature', v as AccountNature)}
          />
        </div>

        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 cursor-pointer select-none text-sm text-[var(--text-secondary)]">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-[var(--bg-border)] bg-[var(--bg-elevated)] accent-[var(--accent)]"
              {...register('is_analytic')}
            />
            Conta analítica (aceita lançamentos)
          </label>
        </div>

        <div className="flex justify-end gap-2 pt-2 border-t border-[var(--bg-border)]">
          <Button type="button" variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button type="submit" loading={isSubmitting}>{editing ? 'Salvar' : 'Criar conta'}</Button>
        </div>
      </form>
    </Modal>
  )
}
