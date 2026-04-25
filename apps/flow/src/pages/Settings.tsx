import { useEffect, useState } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuthStore } from '@/store/auth'
import { useT } from '@/i18n'
import { Button, Card, Input, Select, Table, Badge, Tabs, TabList, Tab, TabPanel, Avatar } from '@syncero/ui'
import { RefreshCw, X } from 'lucide-react'
import { getCompany, updateCompany, getCompanyMembers, inviteCompanyMember, revokeCompanyMember, getAccountantCompanies, inviteAccountant, resendAccountantInvite, cancelAccountantInvite } from '@/lib/backend'
import type { MemberRole, AccountantCompany } from '@/types'

// ── Company tab ───────────────────────────────────────────────

const companySchema = z.object({
  name: z.string().min(2, 'Nome muito curto'),
  cnpj: z.string().optional(),
  tax_regime: z.enum(['simples', 'lucro_presumido', 'lucro_real']).optional(),
})

type CompanyForm = z.infer<typeof companySchema>

function CompanyTab() {
  const t = useT()
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
      if (data.tax_regime) payload.tax_regime = data.tax_regime
      else payload.tax_regime = null
      return updateCompany(activeCompany!.id, payload)
    },
    onSuccess: (_, vars) => {
      setActiveCompany({ ...activeCompany!, name: vars.name })
      qc.invalidateQueries({ queryKey: ['company', activeCompany?.id] })
    },
  })

  return (
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
              { value: 'simples', label: t('settings_simplesNacional') },
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
  )
}

// ── Members tab ───────────────────────────────────────────────

function MembersTab() {
  const t = useT()
  const activeCompany = useAuthStore((s) => s.activeCompany)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState<MemberRole>('member')
  const qc = useQueryClient()

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
      await inviteCompanyMember(activeCompany!.id, inviteEmail, inviteRole, token)
      return token
    },
    onSuccess: () => {
      setInviteEmail('')
      qc.invalidateQueries({ queryKey: ['members', activeCompany?.id] })
    },
  })

  const revoke = useMutation({
    mutationFn: async (id: string) => {
      await revokeCompanyMember(id)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['members', activeCompany?.id] }),
  })

  return (
    <div className="flex flex-col gap-6 max-w-2xl">
      {/* Invite form */}
      <Card>
        <h3 className="text-sm font-medium text-[var(--text-primary)] mb-4">{t('settings_inviteMember')}</h3>
        <div className="flex gap-2 flex-wrap">
          <Input
            placeholder="email@exemplo.com"
            type="email"
            value={inviteEmail}
            onChange={(e) => setInviteEmail(e.target.value)}
            className="flex-1 min-w-48"
          />
          <Select
            options={[
              { value: 'admin',  label: t('settings_admin') },
              { value: 'member', label: t('settings_member') },
              { value: 'viewer', label: t('settings_viewer') },
            ]}
            value={inviteRole}
            onChange={(v) => setInviteRole(v as MemberRole)}
            className="w-40"
          />
          <Button
            onClick={() => invite.mutate()}
            loading={invite.isPending}
            disabled={!inviteEmail}
          >
            {t('settings_invite')}
          </Button>
        </div>
      </Card>

      {/* Members list */}
      <Card padding="sm">
        <Table
          loading={isLoading}
          data={members}
          rowKey={(r) => r.id}
          emptyMessage={t('settings_noMembers')}
          columns={[
            { key: 'email', header: t('settings_email') },
            {
              key: 'role',
              header: t('settings_role'),
              render: (r) => <Badge>{r.role}</Badge>,
            },
            {
              key: 'status',
              header: t('accountant_status'),
              render: (r) => (
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
                r.status !== 'revoked' ? (
                  <Button
                    variant="danger"
                    size="sm"
                    onClick={() => revoke.mutate(r.id)}
                    loading={revoke.isPending}
                  >
                    {t('settings_revoke')}
                  </Button>
                ) : null,
            },
          ]}
        />
      </Card>
    </div>
  )
}

// ── Accountant tab ────────────────────────────────────────────

function AccountantTab() {
  const t = useT()
  const activeCompany = useAuthStore((s) => s.activeCompany)
  const [inviteEmail, setInviteEmail] = useState('')
  const [lastInvitedEmail, setLastInvitedEmail] = useState('')
  const qc = useQueryClient()

  const { data: accountants = [], isLoading } = useQuery<AccountantCompany[]>({
    queryKey: ['accountants', activeCompany?.id],
    queryFn: async () => {
      if (!activeCompany?.id) return []
      return getAccountantCompanies(activeCompany.id)
    },
    enabled: !!activeCompany?.id,
  })

  const invite = useMutation({
    mutationFn: async () => {
      const token = crypto.randomUUID()
      await inviteAccountant(activeCompany!.id, inviteEmail, token)
    },
    onSuccess: () => {
      setLastInvitedEmail(inviteEmail)
      setInviteEmail('')
      qc.invalidateQueries({ queryKey: ['accountants', activeCompany?.id] })
    },
  })

  const resend = useMutation({
    mutationFn: (id: string) => resendAccountantInvite(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['accountants', activeCompany?.id] }),
  })

  const cancel = useMutation({
    mutationFn: (id: string) => cancelAccountantInvite(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['accountants', activeCompany?.id] }),
  })

  return (
    <div className="flex flex-col gap-6 max-w-2xl">
      <Card>
        <h3 className="text-sm font-medium text-[var(--text-primary)] mb-4">{t('settings_inviteAccountant')}</h3>
        <div className="flex gap-2 flex-wrap">
          <Input
            placeholder="contador@escritorio.com"
            type="email"
            value={inviteEmail}
            onChange={(e) => setInviteEmail(e.target.value)}
            className="flex-1 min-w-48"
          />
          <Button
            onClick={() => invite.mutate()}
            loading={invite.isPending}
            disabled={!inviteEmail}
          >
            {t('settings_sendInvite')}
          </Button>
        </div>
        {invite.isSuccess && (
          <p className="mt-3 text-xs text-[var(--success)]">
            {t('settings_inviteSent').replace('{email}', lastInvitedEmail)}
          </p>
        )}
        {invite.isError && (
          <p className="mt-3 text-xs text-[var(--danger)]">
            {(invite.error as Error)?.message ?? t('settings_inviteError')}
          </p>
        )}
      </Card>

      <Card padding="sm">
        <Table
          loading={isLoading}
          data={accountants}
          rowKey={(r) => r.id}
          emptyMessage={t('settings_noAccountants')}
          columns={[
            {
              key: 'accountant',
              header: t('settings_accountant'),
              render: (r) => {
                const p = r.profiles as unknown as { full_name: string; email: string; avatar_url: string | null } | null
                return p ? (
                  <div className="flex items-center gap-2">
                    <Avatar name={p.full_name} src={p.avatar_url} size="sm" />
                    <div>
                      <p className="text-sm text-[var(--text-primary)]">{p.full_name}</p>
                      <p className="text-xs text-[var(--text-muted)]">{p.email}</p>
                    </div>
                  </div>
                ) : (
                  <span className="text-sm text-[var(--text-muted)]">{r.email}</span>
                )
              },
            },
            {
              key: 'status',
              header: t('accountant_status'),
              render: (r) => (
                <Badge variant={r.status === 'accepted' ? 'success' : r.status === 'pending' ? 'warning' : 'danger'}>
                  {r.status === 'accepted' ? t('settings_active') : r.status === 'pending' ? t('settings_waiting') : t('settings_rejected')}
                </Badge>
              ),
            },
            {
              key: 'invited_at',
              header: t('settings_invitedAt'),
              render: (r) => format(new Date(r.invited_at), 'dd/MM/yyyy', { locale: ptBR }),
            },
            {
              key: 'actions',
              header: '',
              align: 'right',
              render: (r) => r.status === 'pending' ? (
                <div className="flex items-center justify-end gap-1">
                  <div className="relative group">
                    <button
                      onClick={() => resend.mutate(r.id)}
                      disabled={resend.isPending && resend.variables === r.id}
                      className="cursor-pointer p-1.5 rounded hover:bg-[var(--bg-border)] text-[var(--text-muted)] hover:text-[var(--accent)] transition-colors disabled:opacity-50"
                    >
                      <RefreshCw className={`h-3.5 w-3.5 ${resend.isPending && resend.variables === r.id ? 'animate-spin' : ''}`} />
                    </button>
                    <span className="pointer-events-none absolute -top-8 left-1/2 -translate-x-1/2 whitespace-nowrap rounded px-2 py-1 text-xs bg-[var(--bg-elevated)] border border-[var(--bg-border)] text-[var(--text-secondary)] opacity-0 group-hover:opacity-100 transition-opacity z-10">
                      {t('settings_resend')}
                    </span>
                  </div>
                  <div className="relative group">
                    <button
                      onClick={() => cancel.mutate(r.id)}
                      disabled={cancel.isPending && cancel.variables === r.id}
                      className="cursor-pointer p-1.5 rounded hover:bg-[var(--bg-border)] text-[var(--text-muted)] hover:text-[var(--danger)] transition-colors disabled:opacity-50"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                    <span className="pointer-events-none absolute -top-8 left-1/2 -translate-x-1/2 whitespace-nowrap rounded px-2 py-1 text-xs bg-[var(--bg-elevated)] border border-[var(--bg-border)] text-[var(--text-secondary)] opacity-0 group-hover:opacity-100 transition-opacity z-10">
                      {t('settings_cancel')}
                    </span>
                  </div>
                </div>
              ) : null,
            },
          ]}
        />
      </Card>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────

export function Component() {
  const t = useT()
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-semibold text-[var(--text-primary)]">{t('settings_title')}</h1>

      <Tabs defaultTab="company">
        <TabList className="mb-6">
          <Tab id="company">{t('settings_company')}</Tab>
          <Tab id="members">{t('settings_members')}</Tab>
          <Tab id="accountant">{t('settings_accountant')}</Tab>
        </TabList>
        <TabPanel id="company"><CompanyTab /></TabPanel>
        <TabPanel id="members"><MembersTab /></TabPanel>
        <TabPanel id="accountant"><AccountantTab /></TabPanel>
      </Tabs>
    </div>
  )
}
