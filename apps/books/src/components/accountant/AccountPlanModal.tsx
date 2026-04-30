import { useEffect, useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Modal, Button, Input, Select } from '@syncero/ui'
import { useT } from '@/i18n'
import type { AccountPlan, AccountType, AccountNature } from '@/types'

type FormData = {
  code: string; name: string; account_type: AccountType
  nature: AccountNature; is_analytic: boolean; parent_id: string | null
}

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
  code:         z.string().min(1).regex(/^[\d.]+$/),
  name:         z.string().min(1),
  account_type: z.enum(['ativo', 'passivo', 'patrimonio_liquido', 'receita', 'despesa', 'custo']),
  nature:       z.enum(['devedora', 'credora']),
  is_analytic:  z.boolean(),
  parent_id:    z.string().nullable(),
})

export interface AccountPlanModalProps {
  open:             boolean
  onClose:          () => void
  onSubmit:         (data: FormData) => Promise<void>
  onSwapConfirm?:   (data: FormData, conflictingId: string) => Promise<void>
  allPlans:         AccountPlan[]
  editing?:         AccountPlan | null
  preset?:          { account_type: AccountType; parent_id: string; parent_code: string } | null
}

export function AccountPlanModal({ open, onClose, onSubmit, onSwapConfirm, allPlans, editing, preset }: AccountPlanModalProps) {
  const t = useT()

  const accountTypeOptions: { value: AccountType; label: string }[] = useMemo(() => [
    { value: 'ativo',             label: t('plano_ativo') },
    { value: 'passivo',           label: t('plano_passivo') },
    { value: 'patrimonio_liquido',label: t('plano_patrimonioLiquido') },
    { value: 'receita',           label: t('plano_receita') },
    { value: 'despesa',           label: t('plano_despesa') },
    { value: 'custo',             label: t('plano_custo') },
  ], [t])

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
  const currentCode = watch('code')

  // Split code into locked prefix + editable suffix when parent exists
  const parentPlan   = allPlans.find(p => p.id === parentId)
  const codePrefix   = parentPlan ? parentPlan.code + '.' : ''

  const [suffixInput, setSuffixInput] = useState('')

  // Keep suffixInput in sync when code changes externally (reset/suggest)
  useEffect(() => {
    const suffix = codePrefix && currentCode.startsWith(codePrefix)
      ? currentCode.slice(codePrefix.length)
      : currentCode
    setSuffixInput(suffix)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentCode])

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
      { value: '', label: t('plano_noParent') },
      ...synthetics.map(p => ({ value: p.id, label: `${p.code} — ${p.name}` })),
    ]
  }, [allPlans, accountType, t])

  const nature = watch('nature')
  const natureLabel = nature === 'devedora' ? t('plano_debtor') : t('plano_creditor')

  const [swapTarget,   setSwapTarget]   = useState<AccountPlan | null>(null)
  const [pendingData,  setPendingData]  = useState<FormData | null>(null)

  const handleFormSubmit = handleSubmit(async (data) => {
    const finalData = { ...data, parent_id: data.parent_id || null } as FormData
    const conflicting = allPlans.find(p => p.code === data.code && p.id !== editing?.id)
    if (conflicting && onSwapConfirm) {
      setSwapTarget(conflicting)
      setPendingData(finalData)
      return
    }
    await onSubmit(finalData)
    onClose()
  })

  // Swap confirmation dialog
  if (swapTarget && pendingData) {
    const codeA = editing?.code ?? pendingData.code
    const codeB = swapTarget.code
    return (
      <Modal
        open
        onClose={() => { setSwapTarget(null); setPendingData(null) }}
        title={t('plano_swapTitle')}
        size="sm"
        footer={
          <div className="flex items-center justify-between">
            <Button variant="ghost" size="sm" onClick={() => { setSwapTarget(null); setPendingData(null) }}>
              {t('plano_cancel')}
            </Button>
            <Button size="sm" onClick={async () => {
              await onSwapConfirm!(pendingData, swapTarget.id)
              setSwapTarget(null); setPendingData(null)
              onClose()
            }}>
              {t('plano_swapConfirm')}
            </Button>
          </div>
        }
      >
        <p className="text-sm text-[var(--text-secondary)] mb-4">
          {t('plano_swapDesc').replace('{code}', codeB).replace('{name}', swapTarget.name)}
        </p>
        <div className="flex items-center gap-3 rounded-lg border border-[var(--bg-border)] bg-[var(--bg-elevated)] p-3 text-sm">
          <div className="flex flex-col gap-1 flex-1 text-center">
            <span className="text-xs text-[var(--text-muted)]">{editing?.name ?? pendingData.name}</span>
            <span className="font-mono font-semibold text-[var(--text-primary)]">{codeA}</span>
            <span className="text-[10px] text-[var(--text-muted)]">→ {codeB}</span>
          </div>
          <span className="text-[var(--text-muted)]">⇄</span>
          <div className="flex flex-col gap-1 flex-1 text-center">
            <span className="text-xs text-[var(--text-muted)]">{swapTarget.name}</span>
            <span className="font-mono font-semibold text-[var(--text-primary)]">{codeB}</span>
            <span className="text-[10px] text-[var(--text-muted)]">→ {codeA}</span>
          </div>
        </div>
        <p className="text-xs text-[var(--text-muted)] mt-3">{t('plano_swapNote')}</p>
      </Modal>
    )
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editing ? t('plano_edit') : t('plano_new')}
      size="md"
    >
      <form onSubmit={handleFormSubmit} className="flex flex-col gap-4">

        {/* 1 — Tipo (filters parent options) + Natureza */}
        <div className="grid grid-cols-2 gap-4">
          <Select
            label={t('plano_fieldType')}
            options={accountTypeOptions}
            value={watch('account_type')}
            onChange={(v) => setValue('account_type', v as AccountType)}
          />
          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-[var(--text-secondary)]">{t('plano_fieldNature')}</span>
            <div className="h-10 flex items-center px-3 rounded-[var(--radius-md)] border border-[var(--bg-border)] bg-[var(--bg-elevated)] text-sm text-[var(--text-muted)]">
              {natureLabel}
            </div>
          </div>
        </div>

        {/* 2 — Conta pai (filtered by type, locks code prefix) */}
        <Select
          label={t('plano_fieldParent')}
          options={parentOptions}
          value={watch('parent_id') ?? ''}
          onChange={(v) => setValue('parent_id', v || null)}
          searchable
        />

        {/* 3 — Código (prefix locked when parent selected) + Nome */}
        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-[var(--text-secondary)]">{t('plano_colCode')}</span>
            {codePrefix ? (
              <div className={`flex items-center h-10 rounded-[var(--radius-md)] border bg-[var(--bg-elevated)] font-mono text-sm transition-colors ${errors.code ? 'border-[var(--danger)]' : 'border-[var(--bg-border)] focus-within:border-[var(--accent)]'}`}>
                <span className="pl-3 text-[var(--text-muted)] select-none shrink-0">{codePrefix}</span>
                <input
                  value={suffixInput}
                  onChange={e => {
                    setSuffixInput(e.target.value)
                    setValue('code', codePrefix + e.target.value, { shouldValidate: true })
                  }}
                  placeholder="01"
                  className="flex-1 bg-transparent outline-none pr-3 text-[var(--text-primary)] min-w-0"
                />
              </div>
            ) : (
              <Input
                placeholder="ex: 1"
                error={errors.code?.message}
                {...register('code')}
              />
            )}
            {errors.code && codePrefix && (
              <span className="text-xs text-[var(--danger)]">{errors.code.message}</span>
            )}
          </div>
          <Input
            label="Nome"
            placeholder="ex: Caixa"
            error={errors.name?.message}
            {...register('name')}
          />
        </div>

        {/* 4 — Analítica / Sintética */}
        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-[var(--text-secondary)]">{t('plano_fieldClass')}</span>
          <div className="flex gap-2">
            {([true, false] as const).map(analytic => (
              <button
                key={String(analytic)}
                type="button"
                onClick={() => setValue('is_analytic', analytic)}
                className={`flex-1 py-1.5 rounded text-sm font-medium transition-colors cursor-pointer ${
                  watch('is_analytic') === analytic
                    ? 'bg-[var(--accent)] text-white'
                    : 'bg-[var(--bg-elevated)] text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
                }`}
              >
                {analytic ? t('plano_analytic') : t('plano_synthetic')}
              </button>
            ))}
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2 border-t border-[var(--bg-border)]">
          <Button type="button" variant="ghost" onClick={onClose}>{t('plano_cancel')}</Button>
          <Button type="submit" loading={isSubmitting}>
            {editing ? t('plano_save') : t('plano_createAccount')}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
