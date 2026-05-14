import { useEffect, useRef, useState } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Button, Input, Select, Modal, useToast, Tabs, TabList, Tab, TabPanel, Card, Badge, Table, Avatar, ConfirmDialog } from '@syncero/ui'
import { Pencil, RefreshCw, X, UserMinus, UserPlus, ChevronDown, Info, Upload, FileKey2, CheckCircle2, Trash2 } from 'lucide-react'
import { format } from 'date-fns'
import { ptBR, enUS } from 'date-fns/locale'
import { useAuthStore } from '@/store/auth'
import { SEGMENTS_WITH_COST } from '@/lib/segments'
import { usePreferencesStore } from '@/store/preferences'
import { useT } from '@/i18n'
import { getCompany, updateCompany, getCompanyMembers, inviteCompanyMember, resendMemberInvite, updateMemberRole, removeCompanyMember, getAccountantCompanies, inviteAccountant, resendAccountantInvite, cancelAccountantInvite, getSefazCredential, saveSefazCredential, deleteSefazCredential, triggerSefazSync, type SefazCredential } from '@/lib/backend'
import { maskCnpj, stripCnpj, validateCnpj } from '@/lib/cnpj'
import type { MemberRole, AccountantCompany, TaxRegime } from '@/types'

const companySchema = z.object({
  name:       z.string().min(2, 'Nome muito curto'),
  trade_name: z.string().optional(),
  cnpj:       z.string().optional().refine((v) => !v || validateCnpj(v), 'CNPJ inválido'),
  tax_regime: z.enum(['simples', 'lucro_presumido', 'lucro_real'], { required_error: 'Obrigatório' }),
  segment:    z.string().min(1, 'Obrigatório'),
})

type CompanyForm = z.infer<typeof companySchema>

function taxRegimeLabel(regime: TaxRegime | null | undefined, t: (k: any) => string) {
  if (regime === 'simples')         return t('settings_simplesNacional')
  if (regime === 'lucro_presumido') return t('settings_lucroPresumido')
  if (regime === 'lucro_real')      return t('settings_lucroReal')
  return '—'
}

// ── Aba Empresa ───────────────────────────────────────────────

function CompanyTab() {
  const t = useT()
  const segmentOptions = [
    { value: '',              label: t('settings_segmentUndefined') },
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
  const segmentLabel = Object.fromEntries(segmentOptions.filter(o => o.value).map(o => [o.value, o.label]))
  const { success, error: toastError } = useToast()
  const activeCompany = useAuthStore((s) => s.activeCompany)
  const setActiveCompany = useAuthStore((s) => s.setActiveCompany)
  const isAdmin = activeCompany?.role === 'admin'
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

  const { register, handleSubmit, reset, control, watch, setValue, formState: { errors, isSubmitting } } = useForm<CompanyForm>({
    resolver: zodResolver(companySchema),
  })

  useEffect(() => {
    if (company) reset({
      name:       company.name,
      trade_name: company.trade_name ?? '',
      cnpj:       company.cnpj ? maskCnpj(company.cnpj) : '',
      tax_regime: company.tax_regime  ?? undefined,
      segment:    company.segment     ?? '',
    })
  }, [company, reset])

  const save = useMutation({
    mutationFn: async (data: CompanyForm) => {
      const payload: Record<string, unknown> = { name: data.name }
      if (data.trade_name !== undefined) payload.trade_name = data.trade_name || null
      if (data.cnpj       !== undefined) payload.cnpj       = stripCnpj(data.cnpj) || null
      payload.tax_regime = data.tax_regime ?? null
      payload.segment    = data.segment    || null
      return updateCompany(activeCompany!.id, payload)
    },
    onSuccess: (_, vars) => {
      setActiveCompany({ ...activeCompany!, name: vars.name, segment: vars.segment ?? activeCompany!.segment })
      qc.invalidateQueries({ queryKey: ['company', activeCompany?.id] })
      success(t('common_savedSuccess'))
      setEditOpen(false)
    },
    onError: () => toastError(t('common_errorGeneric')),
  })

  return (
    <>
      <div className="flex flex-col gap-5">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium text-[var(--text-secondary)]">{t('settings_companyInfo')}</h2>
          {isAdmin && (
            <Button variant="ghost" size="sm" onClick={() => setEditOpen(true)}>
              <Pencil className="h-3.5 w-3.5" />
              {t('settings_edit')}
            </Button>
          )}
        </div>

        <div className="flex flex-col divide-y divide-[var(--bg-border)] rounded-[var(--radius-lg)] border border-[var(--bg-border)] overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3">
            <span className="text-sm text-[var(--text-muted)]">{t('settings_companyName')}</span>
            <span className="text-sm font-medium text-[var(--text-primary)]">{company?.name ?? '—'}</span>
          </div>
          <div className="flex items-center justify-between px-4 py-3">
            <span className="text-sm text-[var(--text-muted)]">{t('settings_tradeName')}</span>
            <span className="text-sm font-medium text-[var(--text-primary)]">{company?.trade_name ?? '—'}</span>
          </div>
          <div className="flex items-center justify-between px-4 py-3">
            <span className="text-sm text-[var(--text-muted)]">{t('settings_cnpj')}</span>
            <span className="text-sm font-medium text-[var(--text-primary)]">{company?.cnpj ? maskCnpj(company.cnpj) : '—'}</span>
          </div>
          <div className="flex items-center justify-between px-4 py-3">
            <span className="text-sm text-[var(--text-muted)]">{t('settings_taxRegime')}</span>
            <span className="text-sm font-medium text-[var(--text-primary)]">{taxRegimeLabel(company?.tax_regime, t)}</span>
          </div>
          <div className="flex items-center justify-between px-4 py-3">
            <span className="text-sm text-[var(--text-muted)]">{t('settings_segment')}</span>
            <span className="text-sm font-medium text-[var(--text-primary)]">{company?.segment ? segmentLabel[company.segment] : '—'}</span>
          </div>
        </div>
      </div>

      <Modal open={editOpen} onClose={() => setEditOpen(false)} title={t('settings_editCompany')} size="sm">
        <form onSubmit={handleSubmit((d) => save.mutateAsync(d))} className="flex flex-col gap-4">
          <Input label={t('settings_companyName')} error={errors.name?.message} {...register('name')} />
          <Input label={t('settings_tradeName')} {...register('trade_name')} />
          <Input
            label={t('settings_cnpj')}
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
          <div className="flex flex-col gap-1.5">
            <Controller
              control={control}
              name="segment"
              render={({ field, fieldState }) => (
                <Select
                  label={t('settings_segment')}
                  placeholder={t('common_select')}
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
                <p className="text-xs text-[var(--text-secondary)]">{t('settings_segmentCostHint')}</p>
              </div>
            ) : (
              <p className="text-xs text-[var(--text-muted)]">{t('settings_segmentHint')}</p>
            )}
          </div>
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

function IconBtn({ onClick, disabled, tooltip, danger, children }: {
  onClick: () => void
  disabled?: boolean
  tooltip: string
  danger?: boolean
  children: React.ReactNode
}) {
  return (
    <div className="relative group">
      <button
        onClick={onClick}
        disabled={disabled}
        className={`cursor-pointer p-1.5 rounded hover:bg-[var(--bg-border)] text-[var(--text-muted)] transition-colors disabled:opacity-50 ${danger ? 'hover:text-[var(--danger)]' : 'hover:text-[var(--accent)]'}`}
      >
        {children}
      </button>
      <span className="pointer-events-none absolute -top-8 right-0 whitespace-nowrap rounded px-2 py-1 text-xs bg-[var(--bg-elevated)] border border-[var(--bg-border)] text-[var(--text-secondary)] opacity-0 group-hover:opacity-100 transition-opacity z-10">
        {tooltip}
      </span>
    </div>
  )
}

function MembersTab() {
  const t = useT()
  const { success, error: toastError } = useToast()
  const activeCompany = useAuthStore((s) => s.activeCompany)
  const language = usePreferencesStore((s) => s.language)
  const isAdmin = activeCompany?.role === 'admin'
  const dateLocale = language === 'pt' ? ptBR : enUS
  const [inviteOpen, setInviteOpen] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState<MemberRole>('member')
  const [removeId, setRemoveId] = useState<string | null>(null)
  const [editRoleId, setEditRoleId] = useState<string | null>(null)
  const [editRole, setEditRole] = useState<MemberRole>('member')
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

  const invalidate = () => qc.invalidateQueries({ queryKey: ['members', activeCompany?.id] })

  const invite = useMutation({
    mutationFn: async () => {
      const token = crypto.randomUUID()
      await inviteCompanyMember(activeCompany!.id, inviteEmail, inviteRole, token, language)
    },
    onSuccess: () => {
      setInviteEmail(''); setInviteRole('member'); setInviteOpen(false)
      invalidate(); success(t('common_inviteSent'))
    },
    onError: (err) => toastError((err as Error)?.message ?? t('common_errorGeneric')),
  })

  const resend = useMutation({
    mutationFn: (id: string) => resendMemberInvite(id),
    onSuccess: () => { invalidate(); success(t('common_inviteSent')) },
    onError: () => toastError(t('common_errorGeneric')),
  })

  const remove = useMutation({
    mutationFn: (id: string) => removeCompanyMember(id),
    onSuccess: () => { invalidate(); success(t('common_deletedSuccess')) },
    onError: () => toastError(t('common_errorGeneric')),
  })

  const changeRole = useMutation({
    mutationFn: ({ id, role }: { id: string; role: string }) => updateMemberRole(id, role),
    onSuccess: () => { setEditRoleId(null); invalidate(); success(t('common_savedSuccess')) },
    onError: () => toastError(t('common_errorGeneric')),
  })

  const [rolesOpen, setRolesOpen] = useState(false)

  const roleOptions = [
    { value: 'admin',  label: t('settings_admin') },
    { value: 'member', label: t('settings_member') },
    { value: 'viewer', label: t('settings_viewer') },
  ]

  const roleLabel = (role: string) => roleOptions.find((o) => o.value === role)?.label ?? role

  const owner = members.find((m) => m.user_id === company?.owner_id)
  const rest = members.filter((m) => m.user_id !== company?.owner_id)
  const sorted = [...(owner ? [owner] : []), ...rest]

  return (
    <div className="flex flex-col gap-5">

      {/* Card informativo de papéis */}
      <div className="rounded-[var(--radius-lg)] border border-[var(--bg-border)] overflow-hidden">
        <button
          onClick={() => setRolesOpen((v) => !v)}
          className="w-full flex items-center justify-between px-4 py-3 bg-[var(--bg-elevated)] hover:bg-[var(--bg-border)] transition-colors cursor-pointer"
        >
          <p className="text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wide">{t('settings_rolesTitle')}</p>
          <ChevronDown className={`h-3.5 w-3.5 text-[var(--text-muted)] transition-transform duration-200 ${rolesOpen ? 'rotate-180' : ''}`} />
        </button>
        {rolesOpen && (
          <div className="grid grid-cols-2 divide-x divide-y divide-[var(--bg-border)] border-t border-[var(--bg-border)]">
            {([
              { key: 'settings_owner',  desc: 'settings_roleOwnerDesc' },
              { key: 'settings_admin',  desc: 'settings_roleAdminDesc' },
              { key: 'settings_member', desc: 'settings_roleMemberDesc' },
              { key: 'settings_viewer', desc: 'settings_roleViewerDesc' },
            ] as const).map(({ key, desc }) => (
              <div key={key} className="flex flex-col gap-1.5 px-4 py-3">
                <Badge className="w-fit">{t(key)}</Badge>
                <p className="text-xs text-[var(--text-muted)] leading-relaxed">{t(desc)}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="flex items-center justify-between">
        <p className="text-sm text-[var(--text-muted)]">
          {members.length} {members.length === 1 ? t('settings_member').toLowerCase() : t('settings_members').toLowerCase()}
        </p>
        {isAdmin && (
          <Button size="sm" onClick={() => setInviteOpen(true)}>
            <UserPlus className="h-3.5 w-3.5" />
            {t('settings_inviteMember')}
          </Button>
        )}
      </div>

      <Card padding="sm">
        <Table
          loading={isLoading}
          data={sorted}
          rowKey={(r) => r.id}
          emptyMessage={t('settings_noMembers')}
          columns={[
            {
              key: 'member',
              header: t('settings_member'),
              render: (r) => {
                const p = r.profiles
                return p ? (
                  <div className="flex items-center gap-2">
                    <Avatar name={p.full_name} src={p.avatar_url} size="sm" />
                    <div>
                      <p className="text-sm text-[var(--text-primary)]">{p.full_name}</p>
                      <p className="text-xs text-[var(--text-muted)]">{p.email || r.email}</p>
                    </div>
                  </div>
                ) : (
                  <span className="text-sm text-[var(--text-muted)]">{r.email}</span>
                )
              },
            },
            {
              key: 'role',
              header: t('settings_role'),
              render: (r) =>
                r.user_id === company?.owner_id ? (
                  <Badge variant="default">{t('settings_owner')}</Badge>
                ) : (
                  <Badge>{roleLabel(r.role)}</Badge>
                ),
            },
            {
              key: 'status',
              header: t('accountant_status'),
              render: (r) =>
                r.user_id === company?.owner_id ? null : (
                  <Badge variant={r.status === 'accepted' ? 'success' : r.status === 'pending' ? 'warning' : 'default'}>
                    {r.status === 'accepted' ? t('settings_active') : r.status === 'pending' ? t('settings_waiting') : t('settings_rejected')}
                  </Badge>
                ),
            },
            {
              key: 'invited_at',
              header: t('settings_invitedAt'),
              render: (r) =>
                r.user_id === company?.owner_id ? null : (
                  <span className="text-sm text-[var(--text-muted)]">
                    {format(new Date(r.invited_at ?? Date.now()), 'dd/MM/yyyy', { locale: dateLocale })}
                  </span>
                ),
            },
            {
              key: 'actions',
              header: '',
              align: 'right',
              className: 'w-px !px-2',
              render: (r) => {
                if (!isAdmin || r.user_id === company?.owner_id) return null

                if (r.status === 'pending') return (
                  <div className="flex items-center justify-end gap-1">
                    <IconBtn onClick={() => resend.mutate(r.id)} disabled={resend.isPending && resend.variables === r.id} tooltip={t('settings_resend')}>
                      <RefreshCw className={`h-3.5 w-3.5 ${resend.isPending && resend.variables === r.id ? 'animate-spin' : ''}`} />
                    </IconBtn>
                    <IconBtn onClick={() => setRemoveId(r.id)} tooltip={t('settings_cancel')} danger>
                      <X className="h-3.5 w-3.5" />
                    </IconBtn>
                  </div>
                )

                if (r.status === 'accepted') return (
                  <div className="flex items-center justify-end gap-1">
                    <IconBtn
                      onClick={() => { setEditRoleId(r.id); setEditRole(r.role as MemberRole) }}
                      tooltip={t('settings_editRole')}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </IconBtn>
                    <IconBtn onClick={() => setRemoveId(r.id)} tooltip={t('settings_unlink')} danger>
                      <UserMinus className="h-3.5 w-3.5" />
                    </IconBtn>
                  </div>
                )

                return null
              },
            },
          ]}
        />
      </Card>

      {/* Modal convite */}
      <Modal open={inviteOpen} onClose={() => { setInviteOpen(false); setInviteEmail('') }} title={t('settings_inviteMember')} size="sm">
        <div className="flex flex-col gap-4">
          <Input label={t('settings_email')} placeholder="email@exemplo.com" type="email" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} autoFocus />
          <Select label={t('settings_role')} options={roleOptions} value={inviteRole} onChange={(v) => setInviteRole(v as MemberRole)} />
          {invite.isError && <p className="text-xs text-[var(--danger)]">{(invite.error as Error)?.message ?? t('settings_inviteError')}</p>}
        </div>
        <div className="flex items-center justify-end gap-3 mt-6 pt-4 border-t border-[var(--bg-border)]">
          <Button variant="ghost" size="sm" onClick={() => { setInviteOpen(false); setInviteEmail('') }}>{t('settings_cancel')}</Button>
          <Button onClick={() => invite.mutate()} loading={invite.isPending} disabled={!inviteEmail}>{t('settings_sendInvite')}</Button>
        </div>
      </Modal>

      {/* Modal editar permissão */}
      <Modal open={!!editRoleId} onClose={() => setEditRoleId(null)} title={t('settings_editRole')} size="sm">
        <Select label={t('settings_role')} options={roleOptions} value={editRole} onChange={(v) => setEditRole(v as MemberRole)} />
        <div className="flex items-center justify-end gap-3 mt-6 pt-4 border-t border-[var(--bg-border)]">
          <Button variant="ghost" size="sm" onClick={() => setEditRoleId(null)}>{t('settings_cancel')}</Button>
          <Button onClick={() => changeRole.mutate({ id: editRoleId!, role: editRole })} loading={changeRole.isPending}>{t('settings_save')}</Button>
        </div>
      </Modal>

      {/* Confirm remover/desvincular */}
      <ConfirmDialog
        open={!!removeId}
        onClose={() => setRemoveId(null)}
        onConfirm={() => { remove.mutate(removeId!); setRemoveId(null) }}
        title={t('settings_removeMemberTitle')}
        message={t('settings_removeMemberMessage')}
        confirmLabel={t('settings_unlink')}
        loading={remove.isPending}
      />
    </div>
  )
}

// ── Aba Contador ──────────────────────────────────────────────

function AccountantTab() {
  const t = useT()
  const { success, error: toastError } = useToast()
  const activeCompany = useAuthStore((s) => s.activeCompany)
  const isAdmin = activeCompany?.role === 'admin'
  const language = usePreferencesStore((s) => s.language)
  const [modalOpen, setModalOpen] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [unlinkId, setUnlinkId] = useState<string | null>(null)
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
      await inviteAccountant(activeCompany!.id, inviteEmail, token, language)
    },
    onSuccess: () => {
      setInviteEmail(''); setModalOpen(false)
      qc.invalidateQueries({ queryKey: ['accountants', activeCompany?.id] })
      success(t('common_inviteSent'))
    },
    onError: () => toastError(t('common_errorGeneric')),
  })

  const resend = useMutation({
    mutationFn: (id: string) => resendAccountantInvite(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['accountants', activeCompany?.id] })
      success(t('common_inviteSent'))
    },
    onError: () => toastError(t('common_errorGeneric')),
  })

  const cancel = useMutation({
    mutationFn: (id: string) => cancelAccountantInvite(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['accountants', activeCompany?.id] })
      success(t('common_deletedSuccess'))
    },
    onError: () => toastError(t('common_errorGeneric')),
  })

  const unlink = useMutation({
    mutationFn: (id: string) => cancelAccountantInvite(id),
    onSuccess: () => {
      setUnlinkId(null)
      qc.invalidateQueries({ queryKey: ['accountants', activeCompany?.id] })
      success(t('common_deletedSuccess'))
    },
    onError: () => toastError(t('common_errorGeneric')),
  })

  return (
    <div className="flex flex-col gap-5">
      {isAdmin && (
        <div className="flex items-center justify-end">
          <Button size="sm" onClick={() => setModalOpen(true)}>
            <UserPlus className="h-3.5 w-3.5" />
            {t('settings_inviteAccountant')}
          </Button>
        </div>
      )}

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
              className: 'w-px !px-2',
              render: (r) => {
                if (!isAdmin) return null
                if (r.status === 'pending') return (
                  <div className="flex items-center justify-end gap-1">
                    <IconBtn onClick={() => resend.mutate(r.id)} disabled={resend.isPending && resend.variables === r.id} tooltip={t('settings_resend')}>
                      <RefreshCw className={`h-3.5 w-3.5 ${resend.isPending && resend.variables === r.id ? 'animate-spin' : ''}`} />
                    </IconBtn>
                    <IconBtn onClick={() => cancel.mutate(r.id)} disabled={cancel.isPending && cancel.variables === r.id} tooltip={t('settings_cancel')} danger>
                      <X className="h-3.5 w-3.5" />
                    </IconBtn>
                  </div>
                )
                if (r.status === 'accepted') return (
                  <IconBtn onClick={() => setUnlinkId(r.id)} tooltip={t('settings_unlink')} danger>
                    <UserMinus className="h-3.5 w-3.5" />
                  </IconBtn>
                )
                return null
              },
            },
          ]}
        />
      </Card>

      <Modal open={modalOpen} onClose={() => { setModalOpen(false); setInviteEmail('') }} title={t('settings_inviteAccountant')} size="sm">
        <div className="flex flex-col gap-4">
          <Input label="Email" placeholder="contador@escritorio.com" type="email" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} autoFocus />
          {invite.isError && <p className="text-xs text-[var(--danger)]">{(invite.error as Error)?.message ?? t('settings_inviteError')}</p>}
        </div>
        <div className="flex items-center justify-end gap-3 mt-6 pt-4 border-t border-[var(--bg-border)]">
          <Button variant="ghost" size="sm" onClick={() => { setModalOpen(false); setInviteEmail('') }}>{t('settings_cancel')}</Button>
          <Button onClick={() => invite.mutate()} loading={invite.isPending} disabled={!inviteEmail}>{t('settings_sendInvite')}</Button>
        </div>
      </Modal>

      <ConfirmDialog
        open={!!unlinkId}
        onClose={() => setUnlinkId(null)}
        onConfirm={() => { unlink.mutate(unlinkId!); setUnlinkId(null) }}
        title={t('settings_unlinkTitle')}
        message={t('settings_unlinkMessage')}
        confirmLabel={t('settings_unlink')}
        loading={unlink.isPending}
      />
    </div>
  )
}

// ── Aba Certificados ──────────────────────────────────────────

const UF_OPTIONS = [
  { value: '12', label: 'AC — Acre' }, { value: '27', label: 'AL — Alagoas' },
  { value: '16', label: 'AP — Amapá' }, { value: '13', label: 'AM — Amazonas' },
  { value: '29', label: 'BA — Bahia' }, { value: '23', label: 'CE — Ceará' },
  { value: '53', label: 'DF — Distrito Federal' }, { value: '32', label: 'ES — Espírito Santo' },
  { value: '52', label: 'GO — Goiás' }, { value: '21', label: 'MA — Maranhão' },
  { value: '51', label: 'MT — Mato Grosso' }, { value: '50', label: 'MS — Mato Grosso do Sul' },
  { value: '31', label: 'MG — Minas Gerais' }, { value: '15', label: 'PA — Pará' },
  { value: '25', label: 'PB — Paraíba' }, { value: '41', label: 'PR — Paraná' },
  { value: '26', label: 'PE — Pernambuco' }, { value: '22', label: 'PI — Piauí' },
  { value: '33', label: 'RJ — Rio de Janeiro' }, { value: '24', label: 'RN — Rio Grande do Norte' },
  { value: '43', label: 'RS — Rio Grande do Sul' }, { value: '11', label: 'RO — Rondônia' },
  { value: '14', label: 'RR — Roraima' }, { value: '42', label: 'SC — Santa Catarina' },
  { value: '35', label: 'SP — São Paulo' }, { value: '28', label: 'SE — Sergipe' },
  { value: '17', label: 'TO — Tocantins' },
]

function CertificatesTab() {
  const t = useT()
  const qc = useQueryClient()
  const { success, error: toastError } = useToast()
  const activeCompany = useAuthStore((s) => s.activeCompany)
  const isAdmin = activeCompany?.role === 'admin'

  const fileRef = useRef<HTMLInputElement>(null)
  const [modalOpen,   setModalOpen]   = useState(false)
  const [certFile,    setCertFile]    = useState<File | null>(null)
  const [password,    setPassword]    = useState('')
  const [environment, setEnvironment] = useState<'production' | 'homologation'>('production')
  const [ufCode,      setUfCode]      = useState('')
  const [revokeOpen,  setRevokeOpen]  = useState(false)

  const { data: company } = useQuery({
    queryKey: ['company', activeCompany?.id],
    queryFn:  () => getCompany(activeCompany!.id),
    enabled:  !!activeCompany?.id,
  })

  const { data: credential, isLoading } = useQuery<SefazCredential | null>({
    queryKey: ['sefaz-credential', activeCompany?.id],
    queryFn:  () => getSefazCredential(activeCompany!.id),
    enabled:  !!activeCompany?.id && isAdmin,
  })

  function closeModal() {
    setModalOpen(false)
    setCertFile(null); setPassword(''); setUfCode('')
    setEnvironment('production')
  }

  const save = useMutation({
    mutationFn: () => {
      if (!certFile) throw new Error('cert required')
      const form = new FormData()
      form.append('company_id',  activeCompany!.id)
      form.append('cert',        certFile)
      form.append('password',    password)
      form.append('environment', environment)
      form.append('uf_code',     ufCode)
      return saveSefazCredential(form)
    },
    onSuccess: () => {
      success(t('sefaz_uploadSuccess'))
      closeModal()
      qc.invalidateQueries({ queryKey: ['sefaz-credential', activeCompany?.id] })
    },
    onError: () => toastError(t('sefaz_uploadError')),
  })

  const revoke = useMutation({
    mutationFn: () => deleteSefazCredential(activeCompany!.id),
    onSuccess: () => {
      setRevokeOpen(false)
      success(t('common_deletedSuccess'))
      qc.invalidateQueries({ queryKey: ['sefaz-credential', activeCompany?.id] })
      qc.invalidateQueries({ queryKey: ['sefaz-credential'] })
    },
    onError: () => toastError(t('common_errorGeneric')),
  })

  const sync = useMutation({
    mutationFn: () => triggerSefazSync(activeCompany!.id),
    onSuccess: () => {
      success(t('sefaz_syncSuccess'))
      qc.invalidateQueries({ queryKey: ['sefaz-credential', activeCompany?.id] })
      qc.invalidateQueries({ queryKey: ['fiscal-documents'] })
    },
    onError: () => toastError(t('sefaz_syncError')),
  })

  const hasCnpj = !!company?.cnpj
  const canSave = hasCnpj && certFile && password && ufCode && !save.isPending

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-32">
        <div className="h-5 w-5 border-2 border-[var(--accent)] border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Botão topo — só quando cert ativo */}
      {isAdmin && credential && (
        <div className="flex items-center justify-end">
          <Button size="sm" onClick={() => setModalOpen(true)}>
            <FileKey2 className="h-3.5 w-3.5" />
            {t('sefaz_addCert')}
          </Button>
        </div>
      )}

      {/* Card: estado do certificado ou empty state */}
      <Card padding="sm">
        {credential ? (
          /* ── Certificado ativo ── */
          <div className="flex flex-col gap-4 p-1">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-lg bg-green-500/10 flex items-center justify-center shrink-0">
                  <CheckCircle2 className="h-5 w-5 text-green-500" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-[var(--text-primary)]">{t('sefaz_active')}</p>
                  <p className="text-xs text-[var(--text-muted)] mt-0.5">
                    {credential.environment === 'production' ? t('sefaz_uploadEnvironmentProd') : t('sefaz_uploadEnvironmentHomol')}
                    {' · '}
                    {UF_OPTIONS.find((u) => u.value === credential.uf_code)?.label ?? credential.uf_code}
                  </p>
                </div>
              </div>
              {isAdmin && (
                <div className="flex gap-2 shrink-0">
                  <Button size="sm" variant="ghost" onClick={() => sync.mutate()} disabled={sync.isPending}>
                    <RefreshCw className={`h-3.5 w-3.5 ${sync.isPending ? 'animate-spin' : ''}`} />
                    {sync.isPending ? t('sefaz_syncing') : t('sefaz_syncNow')}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setRevokeOpen(true)}>
                    <Trash2 className="h-3.5 w-3.5" />
                    {t('sefaz_revoke')}
                  </Button>
                </div>
              )}
            </div>

            {credential.last_sync_at && (
              <div className="pt-3 border-t border-[var(--bg-border)] flex gap-6 text-xs">
                <div>
                  <p className="text-[var(--text-muted)]">{t('sefaz_lastSync')}</p>
                  <p className="text-[var(--text-primary)] font-medium mt-0.5">
                    {new Date(credential.last_sync_at).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}
                  </p>
                </div>
                {credential.last_error && (
                  <div>
                    <p className="text-[var(--text-muted)]">{t('sefaz_lastError')}</p>
                    <p className="text-red-500 font-medium mt-0.5 line-clamp-1">{credential.last_error}</p>
                  </div>
                )}
              </div>
            )}
          </div>
        ) : (
          /* ── Empty state ── */
          <div className="flex flex-col items-center justify-center gap-3 py-10 text-center">
            <div className="h-12 w-12 rounded-xl bg-[var(--bg-elevated)] border border-[var(--bg-border)] flex items-center justify-center">
              <FileKey2 className="h-5 w-5 text-[var(--text-muted)]" />
            </div>
            <div>
              <p className="text-sm font-medium text-[var(--text-primary)]">{t('sefaz_noCertTitle')}</p>
              <p className="text-xs text-[var(--text-muted)] mt-1 max-w-xs">{t('sefaz_noCertHint')}</p>
            </div>
            {isAdmin && (
              <Button size="sm" onClick={() => setModalOpen(true)}>
                <FileKey2 className="h-3.5 w-3.5" />
                {t('sefaz_addCert')}
              </Button>
            )}
          </div>
        )}
      </Card>

      {/* Modal de upload */}
      <Modal open={modalOpen} onClose={closeModal} title={t('sefaz_uploadTitle')} size="md"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={closeModal}>{t('settings_cancel')}</Button>
            <Button onClick={() => save.mutate()} disabled={!canSave}>
              {save.isPending ? t('sefaz_uploadSaving') : t('sefaz_uploadSave')}
            </Button>
          </div>
        }
      >
        <div className="flex flex-col gap-4">
          {!hasCnpj && (
            <div className="flex items-center gap-2 p-3 rounded-[var(--radius-md)] bg-amber-500/10 text-amber-600 text-sm">
              <Info className="h-4 w-4 shrink-0" />
              {t('sefaz_noCnpj')}
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">{t('sefaz_uploadCert')}</label>
            <input ref={fileRef} type="file" accept=".pfx,.p12" className="hidden" onChange={(e) => setCertFile(e.target.files?.[0] ?? null)} />
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="w-full h-20 rounded-[var(--radius-md)] border-2 border-dashed border-[var(--bg-border)] flex flex-col items-center justify-center gap-1.5 text-[var(--text-muted)] hover:border-[var(--accent)] hover:text-[var(--accent)] transition-colors cursor-pointer"
            >
              {certFile ? (
                <><FileKey2 className="h-5 w-5" /><span className="text-xs font-medium">{certFile.name}</span></>
              ) : (
                <><Upload className="h-5 w-5" /><span className="text-xs">{t('sefaz_clickToSelect')}</span></>
              )}
            </button>
            <p className="text-xs text-[var(--text-muted)] mt-1">{t('sefaz_uploadCertHint')}</p>
          </div>

          <div>
            <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">{t('sefaz_uploadPassword')}</label>
            <input
              type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="off"
              className="w-full h-9 px-3 rounded-[var(--radius-md)] border border-[var(--bg-border)] bg-[var(--bg-base)] text-sm text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:border-transparent"
            />
          </div>

          <Select
            label={t('sefaz_uploadUf')}
            options={UF_OPTIONS}
            value={ufCode}
            onChange={setUfCode}
            placeholder="—"
            searchable
            searchPlaceholder="Buscar estado…"
          />

          <div>
            <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">{t('sefaz_uploadEnvironment')}</label>
            <div className="flex gap-2">
              {(['production', 'homologation'] as const).map((env) => (
                <button
                  key={env} type="button" onClick={() => setEnvironment(env)}
                  className={`flex-1 h-9 rounded-[var(--radius-md)] border text-sm font-medium transition-colors cursor-pointer ${
                    environment === env
                      ? 'border-[var(--accent)] bg-[var(--accent)]/10 text-[var(--accent)]'
                      : 'border-[var(--bg-border)] text-[var(--text-secondary)] hover:border-[var(--accent)]'
                  }`}
                >
                  {env === 'production' ? t('sefaz_uploadEnvironmentProd') : t('sefaz_uploadEnvironmentHomol')}
                </button>
              ))}
            </div>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={revokeOpen}
        onClose={() => setRevokeOpen(false)}
        title={t('sefaz_revokeTitle')}
        message={t('sefaz_revokeMessage')}
        confirmLabel={t('sefaz_revoke')}
        onConfirm={() => revoke.mutate()}
        loading={revoke.isPending}
        variant="danger"
      />
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
          <Tab id="accountant">{t('settings_accountant')}</Tab>
          <Tab id="certificates">{t('settings_certificates')}</Tab>
        </TabList>
        <TabPanel id="company">
          <div className="pt-6"><CompanyTab /></div>
        </TabPanel>
        <TabPanel id="members">
          <div className="pt-6"><MembersTab /></div>
        </TabPanel>
        <TabPanel id="accountant">
          <div className="pt-6"><AccountantTab /></div>
        </TabPanel>
        <TabPanel id="certificates">
          <div className="pt-6"><CertificatesTab /></div>
        </TabPanel>
      </Tabs>
    </div>
  )
}
