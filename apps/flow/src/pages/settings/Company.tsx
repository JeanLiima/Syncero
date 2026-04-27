import { useEffect, useState } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Button, Input, Select, Modal, useToast, Tabs, TabList, Tab, TabPanel, Card, Badge, Table } from '@syncero/ui'
import { Pencil } from 'lucide-react'
import { useAuthStore } from '@/store/auth'
import { usePreferencesStore } from '@/store/preferences'
import { useT } from '@/i18n'
import { getCompany, updateCompany, getCompanyMembers, inviteCompanyMember, revokeCompanyMember } from '@/lib/backend'
import type { MemberRole } from '@/types'

const companySchema = z.object({
  name: z.string().min(2, 'Nome muito curto'),
  cnpj: z.string().optional(),
  tax_regime: z.enum(['simples', 'lucro_presumido', 'lucro_real']).optional(),
})

type CompanyForm = z.infer<typeof companySchema>

function taxRegimeLabel(regime: string | null | undefined, t: (k: any) => string) {
  if (regime === 'simples')         return t('settings_simplesNacional')
  if (regime === 'lucro_presumido') return t('settings_lucroPresumido')
  if (regime === 'lucro_real')      return t('settings_lucroReal')
  return '—'
}

// ── Aba Empresa ───────────────────────────────────────────────

function CompanyTab() {
  const t = useT()
  const { success, error: toastError } = useToast()
  const activeCompany = useAuthStore((s) => s.activeCompany)
  const setActiveCompany = useAuthStore((s) => s.setActiveCompany)
  const qc = useQueryClient()
  const [editOpen, setEditOpen] = useState(false)

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
      setEditOpen(false)
    },
    onError: () => toastError(t('common_errorGeneric')),
  })

  return (
    <>
      <div className="flex flex-col gap-5 max-w-lg">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium text-[var(--text-secondary)]">{t('settings_companyInfo')}</h2>
          <Button variant="ghost" size="sm" onClick={() => setEditOpen(true)}>
            <Pencil className="h-3.5 w-3.5" />
            {t('settings_edit')}
          </Button>
        </div>

        <div className="flex flex-col divide-y divide-[var(--bg-border)] rounded-[var(--radius-lg)] border border-[var(--bg-border)] overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3">
            <span className="text-sm text-[var(--text-muted)]">{t('settings_companyName')}</span>
            <span className="text-sm font-medium text-[var(--text-primary)]">{company?.name ?? '—'}</span>
          </div>
          <div className="flex items-center justify-between px-4 py-3">
            <span className="text-sm text-[var(--text-muted)]">{t('settings_cnpj')}</span>
            <span className="text-sm font-medium text-[var(--text-primary)]">{company?.cnpj ?? '—'}</span>
          </div>
          <div className="flex items-center justify-between px-4 py-3">
            <span className="text-sm text-[var(--text-muted)]">{t('settings_taxRegime')}</span>
            <span className="text-sm font-medium text-[var(--text-primary)]">{taxRegimeLabel(company?.tax_regime, t)}</span>
          </div>
        </div>
      </div>

      <Modal open={editOpen} onClose={() => setEditOpen(false)} title={t('settings_editCompany')} size="sm">
        <form onSubmit={handleSubmit((d) => save.mutateAsync(d))} className="flex flex-col gap-4">
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
                  { value: 'simples',         label: t('settings_simplesNacional') },
                  { value: 'lucro_presumido', label: t('settings_lucroPresumido') },
                  { value: 'lucro_real',      label: t('settings_lucroReal') },
                ]}
              />
            )}
          />
          <div className="flex items-center justify-end gap-3 mt-2 pt-4 border-t border-[var(--bg-border)]">
            <Button variant="ghost" size="sm" type="button" onClick={() => setEditOpen(false)}>
              {t('settings_cancel')}
            </Button>
            <Button type="submit" loading={isSubmitting}>{t('settings_save')}</Button>
          </div>
        </form>
      </Modal>
    </>
  )
}

// ── Aba Membros ───────────────────────────────────────────────

function MembersTab() {
  const t = useT()
  const { success, error: toastError } = useToast()
  const activeCompany = useAuthStore((s) => s.activeCompany)
  const language = usePreferencesStore((s) => s.language)
  const isAdmin = activeCompany?.role === 'admin'
  const [inviteOpen, setInviteOpen] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState<MemberRole>('member')
  const qc = useQueryClient()

  const { data: company } = useQuery({
    queryKey: ['company', activeCompany?.id],
    queryFn: async () => {
      if (!activeCompany?.id) return null
      return getCompany(activeCompany.id)
    },
    enabled: !!activeCompany?.id,
  })

  const { data: members = [], isLoading } = useQuery({
    queryKey: ['members', activeCompany?.id],
    queryFn: async () => {
      if (!activeCompany?.id) return []
      return getCompanyMembers(activeCompany.id)
    },
    enabled: !!activeCompany?.id,
  })

  const invite = useMutation({
    mutationFn: async () => {
      const token = crypto.randomUUID()
      await inviteCompanyMember(activeCompany!.id, inviteEmail, inviteRole, token, language)
    },
    onSuccess: () => {
      setInviteEmail('')
      setInviteRole('member')
      setInviteOpen(false)
      qc.invalidateQueries({ queryKey: ['members', activeCompany?.id] })
      success(t('common_inviteSent'))
    },
    onError: (err) => toastError((err as Error)?.message ?? t('common_errorGeneric')),
  })

  const revoke = useMutation({
    mutationFn: async (id: string) => { await revokeCompanyMember(id) },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['members', activeCompany?.id] })
      success(t('common_deletedSuccess'))
    },
    onError: () => toastError(t('common_errorGeneric')),
  })

  const owner = members.find((m) => m.user_id === company?.owner_id)
  const rest = members.filter((m) => m.user_id !== company?.owner_id)

  const displayName = (m: (typeof members)[number]) =>
    m.profiles?.full_name || m.profiles?.email || m.email

  return (
    <div className="flex flex-col gap-5 max-w-2xl">
      <div className="flex items-center justify-between">
        <p className="text-sm text-[var(--text-muted)]">
          {members.length} {members.length === 1 ? t('settings_member').toLowerCase() : t('settings_members').toLowerCase()}
        </p>
        {isAdmin && (
          <Button size="sm" onClick={() => setInviteOpen(true)}>
            {t('settings_inviteMember')}
          </Button>
        )}
      </div>

      <Card padding="sm">
        <Table
          loading={isLoading}
          data={[...(owner ? [owner] : []), ...rest]}
          rowKey={(r) => r.id}
          emptyMessage={t('settings_noMembers')}
          columns={[
            {
              key: 'name',
              header: t('settings_member'),
              render: (r) => (
                <div className="flex flex-col">
                  <span className="text-sm text-[var(--text-primary)]">{displayName(r)}</span>
                  {r.profiles?.full_name && (
                    <span className="text-xs text-[var(--text-muted)]">{r.profiles.email || r.email}</span>
                  )}
                </div>
              ),
            },
            {
              key: 'role',
              header: t('settings_role'),
              render: (r) =>
                r.user_id === company?.owner_id ? (
                  <Badge variant="default">{t('settings_owner')}</Badge>
                ) : (
                  <Badge>{r.role}</Badge>
                ),
            },
            {
              key: 'status',
              header: t('accountant_status'),
              render: (r) =>
                r.user_id === company?.owner_id ? null : (
                  <Badge variant={r.status === 'accepted' ? 'success' : r.status === 'pending' ? 'warning' : 'default'}>
                    {r.status}
                  </Badge>
                ),
            },
            {
              key: 'actions',
              header: '',
              align: 'right',
              render: (r) =>
                isAdmin && r.user_id !== company?.owner_id && r.status !== 'revoked' ? (
                  <Button variant="danger" size="sm" onClick={() => revoke.mutate(r.id)} loading={revoke.isPending}>
                    {t('settings_revoke')}
                  </Button>
                ) : null,
            },
          ]}
        />
      </Card>

      <Modal
        open={inviteOpen}
        onClose={() => setInviteOpen(false)}
        title={t('settings_inviteMember')}
        size="sm"
      >
        <div className="flex flex-col gap-4">
          <Input
            label={t('settings_email')}
            placeholder="email@exemplo.com"
            type="email"
            value={inviteEmail}
            onChange={(e) => setInviteEmail(e.target.value)}
            autoFocus
          />
          <Select
            label={t('settings_role')}
            options={[
              { value: 'admin',  label: t('settings_admin') },
              { value: 'member', label: t('settings_member') },
              { value: 'viewer', label: t('settings_viewer') },
            ]}
            value={inviteRole}
            onChange={(v) => setInviteRole(v as MemberRole)}
          />
        </div>
        <div className="flex items-center justify-end gap-3 mt-6 pt-4 border-t border-[var(--bg-border)]">
          <Button variant="ghost" size="sm" onClick={() => setInviteOpen(false)}>
            {t('settings_cancel')}
          </Button>
          <Button onClick={() => invite.mutate()} loading={invite.isPending} disabled={!inviteEmail}>
            {t('settings_invite')}
          </Button>
        </div>
      </Modal>
    </div>
  )
}

// ── Página ────────────────────────────────────────────────────

export function Component() {
  const t = useT()

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-semibold text-[var(--text-primary)]">{t('settings_company')}</h1>
      <Tabs defaultTab="company">
        <TabList>
          <Tab id="company">{t('settings_company')}</Tab>
          <Tab id="members">{t('settings_members')}</Tab>
        </TabList>
        <TabPanel id="company">
          <div className="pt-6">
            <CompanyTab />
          </div>
        </TabPanel>
        <TabPanel id="members">
          <div className="pt-6">
            <MembersTab />
          </div>
        </TabPanel>
      </Tabs>
    </div>
  )
}
