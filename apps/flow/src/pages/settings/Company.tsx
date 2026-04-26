import { useEffect } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Button, Input, Select, useToast } from '@syncero/ui'
import { useAuthStore } from '@/store/auth'
import { useT } from '@/i18n'
import { getCompany, updateCompany } from '@/lib/backend'

const companySchema = z.object({
  name: z.string().min(2, 'Nome muito curto'),
  cnpj: z.string().optional(),
  tax_regime: z.enum(['simples', 'lucro_presumido', 'lucro_real']).optional(),
})

type CompanyForm = z.infer<typeof companySchema>

export function Component() {
  const t = useT()
  const { success, error: toastError } = useToast()
  const activeCompany = useAuthStore((s) => s.activeCompany)
  const setActiveCompany = useAuthStore((s) => s.setActiveCompany)
  const qc = useQueryClient()

  const { data: company } = useQuery({
    queryKey: ['company', activeCompany?.id],
    queryFn: async () => {
      if (!activeCompany?.id) return null
      return getCompany(activeCompany.id)
    },
    enabled: !!activeCompany?.id,
  })

  const { register, handleSubmit, reset, control, formState: { errors, isSubmitting } } = useForm<CompanyForm>({
    resolver: zodResolver(companySchema),
  })

  useEffect(() => {
    if (company) reset({ name: company.name, cnpj: company.cnpj ?? '', tax_regime: company.tax_regime ?? undefined })
  }, [company, reset])

  const save = useMutation({
    mutationFn: async (data: CompanyForm) => {
      const payload: Record<string, unknown> = { name: data.name }
      if (data.cnpj !== undefined) payload.cnpj = data.cnpj || null
      payload.tax_regime = data.tax_regime ?? null
      return updateCompany(activeCompany!.id, payload)
    },
    onSuccess: (_, vars) => {
      setActiveCompany({ ...activeCompany!, name: vars.name })
      qc.invalidateQueries({ queryKey: ['company', activeCompany?.id] })
      success(t('common_savedSuccess'))
    },
    onError: () => toastError(t('common_errorGeneric')),
  })

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-semibold text-[var(--text-primary)]">{t('settings_company')}</h1>
      <form onSubmit={handleSubmit((d) => save.mutateAsync(d))} className="flex flex-col gap-4 max-w-lg">
        <Input label={t('settings_companyName')} error={errors.name?.message} {...register('name')} />
        <Input label={t('settings_cnpj')} {...register('cnpj')} />
        <Controller
          control={control}
          name="tax_regime"
          render={({ field }) => (
            <Select
              label={t('settings_taxRegime')}
              placeholder={t('common_select')}
              value={field.value ?? ''}
              onChange={(v) => field.onChange(v || undefined)}
              onBlur={field.onBlur}
              options={[
                { value: 'simples',          label: t('settings_simplesNacional') },
                { value: 'lucro_presumido',  label: t('settings_lucroPresumido') },
                { value: 'lucro_real',       label: t('settings_lucroReal') },
              ]}
            />
          )}
        />
        <div className="flex gap-3 mt-2">
          <Button type="submit" loading={isSubmitting}>{t('settings_save')}</Button>
        </div>
      </form>
    </div>
  )
}
