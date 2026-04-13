import { useState } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { LogOut } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/auth'
import { useAuth } from '@/hooks/useAuth'
import { useToast } from '@/components/ui/Toast'
import { useT } from '@/i18n'
import { Button, Card, Input, Select, Avatar } from '@/components/ui'

function formatCNPJ(value: string): string {
  const d = value.replace(/\D/g, '').slice(0, 14)
  if (d.length <= 2)  return d
  if (d.length <= 5)  return `${d.slice(0,2)}.${d.slice(2)}`
  if (d.length <= 8)  return `${d.slice(0,2)}.${d.slice(2,5)}.${d.slice(5)}`
  if (d.length <= 12) return `${d.slice(0,2)}.${d.slice(2,5)}.${d.slice(5,8)}/${d.slice(8)}`
  return `${d.slice(0,2)}.${d.slice(2,5)}.${d.slice(5,8)}/${d.slice(8,12)}-${d.slice(12)}`
}

const schema = z.object({
  name: z.string().min(2),
  cnpj: z.string().optional(),
  tax_regime: z.enum(['simples', 'lucro_presumido', 'lucro_real']).optional(),
})
type FormData = z.infer<typeof schema>

export function NoCompanyShell() {
  const t = useT()
  const { user, profile, signOut } = useAuth()
  const setActiveCompany = useAuthStore((s) => s.setActiveCompany)
  const { success, error: toastError } = useToast()
  const [cnpjDisplay, setCnpjDisplay] = useState('')

  const { register, handleSubmit, control, setValue, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
  })

  const displayName =
    user?.user_metadata?.full_name ??
    user?.user_metadata?.name ??
    user?.email?.split('@')[0] ??
    'Usuário'

  const avatarUrl: string | null =
    profile?.avatar_url ?? user?.user_metadata?.avatar_url ?? null

  const handleCnpjChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatCNPJ(e.target.value)
    setCnpjDisplay(formatted)
    setValue('cnpj', formatted.replace(/\D/g, '') || undefined)
  }

  const onSubmit = async (data: FormData) => {
    const { data: { user: currentUser }, error: authError } = await supabase.auth.getUser()
    if (authError || !currentUser) {
      toastError('Usuário não autenticado.')
      return
    }

    const payload: Record<string, unknown> = {
      name: data.name,
      owner_id: currentUser.id,
    }
    if (data.cnpj) payload.cnpj = data.cnpj
    if (data.tax_regime) payload.tax_regime = data.tax_regime

    const { data: company, error } = await supabase
      .from('companies')
      .insert(payload)
      .select('id, name')
      .single()

    if (error) {
      toastError(error.message)
      return
    }
    if (company) {
      setActiveCompany({ id: company.id, name: company.name, role: 'admin' })
      success(t('noCompany_success'))
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--bg-base)] p-4">
      <div className="w-full max-w-md">
        <div className="flex justify-center mb-8">
          <div className="h-14 w-14 rounded-2xl bg-[var(--accent)] flex items-center justify-center shadow-lg">
            <span className="text-white font-bold text-xl">FF</span>
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
              label={t('noCompany_cnpjLabel')}
              placeholder="00.000.000/0000-00"
              value={cnpjDisplay}
              onChange={handleCnpjChange}
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
            <Button type="submit" loading={isSubmitting} className="w-full mt-2">
              {t('noCompany_submit')}
            </Button>
          </form>
        </Card>
      </div>
    </div>
  )
}
