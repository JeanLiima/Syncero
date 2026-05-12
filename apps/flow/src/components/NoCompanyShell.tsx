import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { maskCnpj, stripCnpj, validateCnpj } from '@/lib/cnpj'
import { LogOut, Info } from 'lucide-react'
import { apiFetch } from '@/lib/api'
import { useAuthStore } from '@/store/auth'
import { useAuth } from '@/hooks/useAuth'
import { useToast, Button, Card, Input, Select, Avatar } from '@syncero/ui'
import { useT } from '@/i18n'
import { SEGMENTS_WITH_COST } from '@/lib/segments'


const schema = z.object({
  name:       z.string().min(2),
  trade_name: z.string().optional(),
  cnpj:       z.string().optional().refine((v) => !v || validateCnpj(v), 'CNPJ inválido'),
  tax_regime: z.enum(['simples', 'lucro_presumido', 'lucro_real'], { required_error: 'Obrigatório' }),
  segment:    z.string().min(1, 'Obrigatório'),
})
type FormData = z.infer<typeof schema>

export function NoCompanyShell() {
  const t = useT()
  const segmentOptions = [
    { value: 'retail',        label: t('settings_segmentComercio') },
    { value: 'services',      label: t('settings_segmentServicos') },
    { value: 'manufacturing', label: t('settings_segmentIndustria') },
    { value: 'construction',  label: t('settings_segmentConstrucao') },
    { value: 'agribusiness',  label: t('settings_segmentAgronegocio') },
    { value: 'healthcare',    label: t('settings_segmentSaude') },
    { value: 'education',     label: t('settings_segmentEducacao') },
    { value: 'technology',    label: t('settings_segmentTecnologia') },
    { value: 'financial',     label: t('settings_segmentFinanceiro') },
    { value: 'other',         label: t('settings_segmentOutros') },
  ]
  const { user, profile, signOut } = useAuth()
  const setActiveCompany = useAuthStore((s) => s.setActiveCompany)
  const { success, error: toastError } = useToast()
  const { register, handleSubmit, control, watch, setValue, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
  })

  const displayName =
    user?.user_metadata?.full_name ??
    user?.user_metadata?.name ??
    user?.email?.split('@')[0] ??
    t('layout_userFallback')

  const avatarUrl: string | null =
    profile?.avatar_url ?? user?.user_metadata?.avatar_url ?? null

  const onSubmit = async (data: FormData) => {
    try {
      const company = await apiFetch<{ id: string; name: string }>('/api/companies', {
        method: 'POST',
        body: JSON.stringify({
          name:       data.name,
          trade_name: data.trade_name || undefined,
          cnpj:       stripCnpj(data.cnpj ?? '') || undefined,
          tax_regime: data.tax_regime || undefined,
          segment:    data.segment    || undefined,
        }),
      })
      setActiveCompany({ id: company.id, name: company.name, role: 'admin', segment: data.segment ?? null })
      success(t('noCompany_success'))
    } catch (err) {
      toastError(err instanceof Error ? err.message : 'Erro ao criar empresa.')
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--bg-base)] p-4">
      <div className="w-full max-w-md">
        <div className="flex justify-center mb-8">
          <div className="h-14 w-14 rounded-2xl bg-[var(--accent)] flex items-center justify-center shadow-lg">
            <span className="text-white font-bold text-xl">SF</span>
          </div>
        </div>

        <Card>
          <div className="flex items-center gap-3 mb-6 pb-6 border-b border-[var(--bg-border)]">
            <Avatar name={displayName} src={avatarUrl} size="md" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-[var(--text-primary)] truncate">
                {displayName.split(' ')[0]}
              </p>
              <p className="text-xs text-[var(--text-secondary)] truncate">{user?.email}</p>
            </div>
            <button
              onClick={signOut}
              className="p-1.5 rounded-[var(--radius-sm)] text-[var(--text-muted)] hover:text-[var(--danger)] hover:bg-[var(--bg-elevated)] transition-colors cursor-pointer"
              title={t('nav_signOut')}
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>

          <div className="mb-5">
            <h1 className="text-base font-semibold text-[var(--text-primary)]">{t('noCompany_title')}</h1>
            <p className="text-sm text-[var(--text-secondary)] mt-1">{t('noCompany_subtitle')}</p>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
            <Input
              label={t('noCompany_nameLabel')}
              error={errors.name?.message}
              {...register('name')}
            />
            <Input
              label={t('noCompany_tradeNameLabel')}
              placeholder={t('noCompany_tradeNamePlaceholder')}
              {...register('trade_name')}
            />
            <Input
              label={t('noCompany_cnpjLabel')}
              placeholder="00.000.000/0000-00"
              {...register('cnpj')}
              onChange={(e) => setValue('cnpj', maskCnpj(e.target.value), { shouldValidate: true })}
              error={errors.cnpj?.message}
              maxLength={18}
            />
            <Controller
              control={control}
              name="tax_regime"
              render={({ field }) => (
                <Select
                  label={t('noCompany_taxRegimeLabel')}
                  placeholder={t('noCompany_taxRegimePlaceholder')}
                  value={field.value ?? ''}
                  onChange={(v) => field.onChange(v || undefined)}
                  onBlur={field.onBlur}
                  options={[
                    { value: 'simples',         label: t('settings_simplesNacional') },
                    { value: 'lucro_presumido', label: t('settings_lucroPresumido') },
                    { value: 'lucro_real',      label: t('settings_lucroReal') },
                  ]}
                />
              )}
            />
            <div className="flex flex-col gap-1.5">
              <Controller
                control={control}
                name="segment"
                render={({ field, fieldState }) => (
                  <Select
                    label={t('noCompany_segmentLabel')}
                    placeholder={t('noCompany_segmentPlaceholder')}
                    value={field.value ?? ''}
                    onChange={(v) => field.onChange(v || '')}
                    onBlur={field.onBlur}
                    options={segmentOptions}
                    searchable
                    error={fieldState.error?.message}
                  />
                )}
              />
              {SEGMENTS_WITH_COST.has(watch('segment') ?? '') ? (
                <div className="flex items-start gap-1.5 rounded-md bg-[var(--accent)]/10 border border-[var(--accent)]/20 px-2.5 py-2">
                  <Info className="h-3.5 w-3.5 text-[var(--accent)] shrink-0 mt-0.5" />
                  <p className="text-xs text-[var(--text-secondary)]">{t('noCompany_segmentCostHint')}</p>
                </div>
              ) : (
                <p className="text-xs text-[var(--text-muted)]">{t('noCompany_segmentHint')}</p>
              )}
            </div>
            <Button type="submit" loading={isSubmitting} className="w-full mt-2">
              {t('noCompany_submit')}
            </Button>
          </form>
        </Card>
      </div>
    </div>
  )
}
