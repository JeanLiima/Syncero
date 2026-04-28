import { useEffect, useMemo } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Modal, Button, Input, Select, Checkbox } from '@syncero/ui'
import type { AccountPlan, AccountType, AccountNature } from '@/types'

// ── helpers ───────────────────────────────────────────────────

const defaultNature: Record<AccountType, AccountNature> = {
  ativo:             'devedora',
  despesa:           'devedora',
  custo:             'devedora',
  passivo:           'credora',
  patrimonio_liquido:'credora',
  receita:           'credora',
}

function suggestNextCode(parentCode: string, allPlans: AccountPlan[]): string {
  const prefix = parentCode + '.'
  const directChildren = allPlans.filter(p => {
    if (!p.code.startsWith(prefix)) return false
    return !p.code.slice(prefix.length).includes('.')
  })
  if (directChildren.length === 0) return `${parentCode}.01`

  const lastSegs = directChildren.map(c => c.code.slice(prefix.length))
  const max = Math.max(...lastSegs.map(s => parseInt(s, 10) || 0))
  const padLen = Math.max(...lastSegs.map(s => s.length))
  return prefix + String(max + 1).padStart(padLen, '0')
}

// ── types ─────────────────────────────────────────────────────

const schema = z.object({
  code:         z.string().min(1, 'Obrigatório').regex(/^[\d.]+$/, 'Apenas dígitos e pontos'),
  name:         z.string().min(1, 'Obrigatório'),
  account_type: z.enum(['ativo', 'passivo', 'patrimonio_liquido', 'receita', 'despesa', 'custo']),
  nature:       z.enum(['devedora', 'credora']),
  is_analytic:  z.boolean(),
  parent_id:    z.string().nullable(),
})

type FormData = z.infer<typeof schema>

const accountTypeOptions: { value: AccountType; label: string }[] = [
  { value: 'ativo',             label: 'Ativo' },
  { value: 'passivo',           label: 'Passivo' },
  { value: 'patrimonio_liquido',label: 'Patrimônio Líquido' },
  { value: 'receita',           label: 'Receita' },
  { value: 'despesa',           label: 'Despesa' },
  { value: 'custo',             label: 'Custo' },
]

export interface AccountPlanModalProps {
  open:      boolean
  onClose:   () => void
  onSubmit:  (data: FormData) => Promise<void>
  allPlans:  AccountPlan[]
  editing?:  AccountPlan | null
  /** Pre-select type and parent when opening via + child button */
  preset?:   { account_type: AccountType; parent_id: string; parent_code: string } | null
}

export function AccountPlanModal({ open, onClose, onSubmit, allPlans, editing, preset }: AccountPlanModalProps) {
  const {
    register, handleSubmit, watch, setValue, reset,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      code: '', name: '', account_type: 'ativo',
      nature: 'devedora', is_analytic: true, parent_id: null,
    },
  })

  // ── reset on open ───────────────────────────────────────────
  useEffect(() => {
    if (!open) return
    if (editing) {
      reset({
        code:         editing.code,
        name:         editing.name,
        account_type: editing.account_type,
        nature:       editing.nature,
        is_analytic:  editing.is_analytic,
        parent_id:    editing.parent_id,
      })
    } else if (preset) {
      const suggested = suggestNextCode(preset.parent_code, allPlans)
      reset({
        code:         suggested,
        name:         '',
        account_type: preset.account_type,
        nature:       defaultNature[preset.account_type],
        is_analytic:  true,
        parent_id:    preset.parent_id,
      })
    } else {
      reset({ code: '', name: '', account_type: 'ativo', nature: 'devedora', is_analytic: true, parent_id: null })
    }
  }, [open, editing, preset]) // eslint-disable-line react-hooks/exhaustive-deps

  const accountType = watch('account_type')
  const parentId    = watch('parent_id')

  // auto-set nature when type changes
  useEffect(() => {
    setValue('nature', defaultNature[accountType as AccountType])
  }, [accountType, setValue])

  // auto-suggest code when parent changes (only in create mode)
  useEffect(() => {
    if (editing || !parentId) return
    const parent = allPlans.find(p => p.id === parentId)
    if (!parent) return
    setValue('code', suggestNextCode(parent.code, allPlans))
  }, [parentId]) // eslint-disable-line react-hooks/exhaustive-deps

  // filter parent options by selected type
  const parentOptions = useMemo(() => {
    const synthetics = allPlans.filter(p => !p.is_analytic && p.account_type === accountType)
    return [
      { value: '', label: '— Raiz (sem pai) —' },
      ...synthetics.map(p => ({ value: p.id, label: `${p.code} — ${p.name}` })),
    ]
  }, [allPlans, accountType])

  const nature = watch('nature')
  const natureLabel = nature === 'devedora' ? 'Devedora' : 'Credora'

  const handleFormSubmit = handleSubmit(async (data) => {
    await onSubmit({ ...data, parent_id: data.parent_id || null })
    onClose()
  })

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editing ? 'Editar conta' : 'Nova conta'}
      size="md"
    >
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

        <div className="grid grid-cols-2 gap-4">
          <Select
            label="Tipo"
            options={accountTypeOptions}
            value={watch('account_type')}
            onChange={(v) => setValue('account_type', v as AccountType)}
          />
          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-[var(--text-secondary)]">Natureza</span>
            <div className="h-10 flex items-center px-3 rounded-[var(--radius-md)] border border-[var(--bg-border)] bg-[var(--bg-elevated)] text-sm text-[var(--text-muted)]">
              {natureLabel}
            </div>
          </div>
        </div>

        <Select
          label="Conta pai"
          options={parentOptions}
          value={watch('parent_id') ?? ''}
          onChange={(v) => setValue('parent_id', v || null)}
          searchable
        />

        <Checkbox label="Conta analítica (aceita lançamentos)" {...register('is_analytic')} />

        <div className="flex justify-end gap-2 pt-2 border-t border-[var(--bg-border)]">
          <Button type="button" variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button type="submit" loading={isSubmitting}>
            {editing ? 'Salvar' : 'Criar conta'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
