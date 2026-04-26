import { useEffect, useState, type ChangeEvent } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuthStore } from '@/store/auth'
import { usePreferencesStore } from '@/store/preferences'
import { useT } from '@/i18n'
import { Button, Card, Input, Select, Table, Badge, Tabs, TabList, Tab, TabPanel, Avatar, Modal, ConfirmDialog } from '@syncero/ui'
import { RefreshCw, X, UserMinus, UserPlus, Pencil, Trash2, Plus } from 'lucide-react'
import { getCompany, updateCompany, getCompanyMembers, inviteCompanyMember, revokeCompanyMember, getAccountantCompanies, inviteAccountant, resendAccountantInvite, cancelAccountantInvite, getCategories, getCategoryUsage, createCategory, updateCategory, deleteCategory, getBanks, createBank, updateBank, deleteBank } from '@/lib/backend'
import type { MemberRole, AccountantCompany, Category, TransactionType, Bank } from '@/types'

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
      setInviteEmail('')
      setModalOpen(false)
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

  const unlink = useMutation({
    mutationFn: (id: string) => cancelAccountantInvite(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['accountants', activeCompany?.id] }),
  })

  return (
    <div className="flex flex-col gap-6">
      <Modal
        open={modalOpen}
        onClose={() => { setModalOpen(false); setInviteEmail('') }}
        title={t('settings_inviteAccountant')}
        size="sm"
      >
        <div className="flex flex-col gap-4">
          <Input
            label="Email"
            placeholder="contador@escritorio.com"
            type="email"
            value={inviteEmail}
            onChange={(e) => setInviteEmail(e.target.value)}
          />
          {invite.isError && (
            <p className="text-xs text-[var(--danger)]">
              {(invite.error as Error)?.message ?? t('settings_inviteError')}
            </p>
          )}
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => { setModalOpen(false); setInviteEmail('') }}>
              {t('settings_cancel')}
            </Button>
            <Button onClick={() => invite.mutate()} loading={invite.isPending} disabled={!inviteEmail}>
              {t('settings_sendInvite')}
            </Button>
          </div>
        </div>
      </Modal>

      <Card padding="sm">
        <Table
          loading={isLoading}
          data={accountants}
          rowKey={(r) => r.id}
          emptyMessage={
            <div className="flex flex-col items-center gap-3">
              <p className="text-sm text-[var(--text-muted)]">{t('settings_noAccountants')}</p>
              <Button size="sm" variant="ghost" onClick={() => setModalOpen(true)}>
                <UserPlus className="h-4 w-4" />
                {t('settings_inviteAccountant')}
              </Button>
            </div>
          }
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
                if (r.status === 'pending') return (
                  <div className="flex items-center justify-end gap-1">
                    <div className="relative group">
                      <button
                        onClick={() => resend.mutate(r.id)}
                        disabled={resend.isPending && resend.variables === r.id}
                        className="cursor-pointer p-1.5 rounded hover:bg-[var(--bg-border)] text-[var(--text-muted)] hover:text-[var(--accent)] transition-colors disabled:opacity-50"
                      >
                        <RefreshCw className={`h-3.5 w-3.5 ${resend.isPending && resend.variables === r.id ? 'animate-spin' : ''}`} />
                      </button>
                      <span className="pointer-events-none absolute -top-8 right-0 whitespace-nowrap rounded px-2 py-1 text-xs bg-[var(--bg-elevated)] border border-[var(--bg-border)] text-[var(--text-secondary)] opacity-0 group-hover:opacity-100 transition-opacity z-10">
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
                      <span className="pointer-events-none absolute -top-8 right-0 whitespace-nowrap rounded px-2 py-1 text-xs bg-[var(--bg-elevated)] border border-[var(--bg-border)] text-[var(--text-secondary)] opacity-0 group-hover:opacity-100 transition-opacity z-10">
                        {t('settings_cancel')}
                      </span>
                    </div>
                  </div>
                )

                if (r.status === 'accepted') return (
                  <div className="relative group">
                    <button
                      onClick={() => setUnlinkId(r.id)}
                      disabled={unlink.isPending && unlink.variables === r.id}
                      className="cursor-pointer p-1.5 rounded hover:bg-[var(--bg-border)] text-[var(--text-muted)] hover:text-[var(--danger)] transition-colors disabled:opacity-50"
                    >
                      <UserMinus className="h-3.5 w-3.5" />
                    </button>
                    <span className="pointer-events-none absolute -top-8 right-0 whitespace-nowrap rounded px-2 py-1 text-xs bg-[var(--bg-elevated)] border border-[var(--bg-border)] text-[var(--text-secondary)] opacity-0 group-hover:opacity-100 transition-opacity z-10">
                      {t('settings_unlink')}
                    </span>
                  </div>
                )

                return null
              },
            },
          ]}
        />
      </Card>

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

// ── Categories tab ────────────────────────────────────────────

const COLORS = [
  '#10b981', '#3b82f6', '#f43f5e', '#f59e0b',
  '#8b5cf6', '#ec4899', '#6366f1', '#14b8a6',
  '#ef4444', '#fb923c', '#94a3b8', '#a78bfa',
]

function ColorPicker({ value, onChange }: { value: string | null; onChange: (c: string) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {COLORS.map((c) => (
        <button
          key={c}
          type="button"
          onClick={() => onChange(c)}
          className="h-6 w-6 rounded-full border-2 transition-transform hover:scale-110 cursor-pointer"
          style={{
            backgroundColor: c,
            borderColor: value === c ? 'white' : 'transparent',
            boxShadow: value === c ? `0 0 0 2px ${c}` : undefined,
          }}
        />
      ))}
    </div>
  )
}

type CategoryForm = { name: string; type: TransactionType; color: string }

function CategoriesTab() {
  const t = useT()
  const activeCompany = useAuthStore((s) => s.activeCompany)
  const qc = useQueryClient()

  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Category | null>(null)
  const [form, setForm] = useState<CategoryForm>({ name: '', type: 'income', color: COLORS[0] })
  const [typeFilter, setTypeFilter] = useState<'all' | TransactionType>('all')

  // Delete state
  const [deleting, setDeleting] = useState<Category | null>(null)
  const [usageCount, setUsageCount] = useState<number | null>(null)
  const [transferTo, setTransferTo] = useState<string>('')

  const { data: categories = [], isLoading } = useQuery<Category[]>({
    queryKey: ['categories', activeCompany?.id],
    queryFn: () => getCategories(activeCompany!.id),
    enabled: !!activeCompany?.id,
  })

  const filtered = typeFilter === 'all' ? categories : categories.filter((c) => c.type === typeFilter)

  const openCreate = () => {
    setEditing(null)
    setForm({ name: '', type: 'income', color: COLORS[0] })
    setModalOpen(true)
  }

  const openEdit = (cat: Category) => {
    setEditing(cat)
    setForm({ name: cat.name, type: cat.type, color: cat.color ?? COLORS[0] })
    setModalOpen(true)
  }

  const openDelete = async (cat: Category) => {
    setDeleting(cat)
    setUsageCount(null)
    setTransferTo('')
    const { count } = await getCategoryUsage(cat.id)
    setUsageCount(count)
  }

  const save = useMutation({
    mutationFn: async () => {
      if (editing) {
        return updateCategory(editing.id, form)
      }
      return createCategory({ company_id: activeCompany!.id, ...form })
    },
    onSuccess: () => {
      setModalOpen(false)
      qc.invalidateQueries({ queryKey: ['categories', activeCompany?.id] })
    },
  })

  const remove = useMutation({
    mutationFn: async () => {
      const to = transferTo || null
      return deleteCategory(deleting!.id, to)
    },
    onSuccess: () => {
      setDeleting(null)
      qc.invalidateQueries({ queryKey: ['categories', activeCompany?.id] })
    },
  })

  const otherCategories = categories.filter(
    (c) => c.id !== deleting?.id && c.type === deleting?.type,
  )

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-4">
        <div className="flex gap-1">
          {(['all', 'income', 'expense'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setTypeFilter(f)}
              className={`cursor-pointer px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                typeFilter === f
                  ? 'bg-[var(--accent)] text-white'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)]'
              }`}
            >
              {f === 'all' ? t('categories_all') : f === 'income' ? t('categories_income') : t('categories_expense')}
            </button>
          ))}
        </div>
        <Button size="sm" onClick={openCreate}>
          <Plus className="h-4 w-4" />
          {t('categories_new')}
        </Button>
      </div>

      <Card padding="sm">
        <Table
          loading={isLoading}
          data={filtered}
          rowKey={(r) => r.id}
          emptyMessage={t('categories_empty')}
          columns={[
            {
              key: 'color',
              header: '',
              className: 'w-px !px-3',
              render: (r) => (
                <div className="h-3 w-3 rounded-full" style={{ backgroundColor: r.color ?? '#94a3b8' }} />
              ),
            },
            {
              key: 'name',
              header: t('categories_name'),
              render: (r) => <span className="text-sm text-[var(--text-primary)]">{r.name}</span>,
            },
            {
              key: 'type',
              header: t('categories_type'),
              render: (r) => (
                <Badge variant={r.type === 'income' ? 'success' : 'danger'}>
                  {r.type === 'income' ? t('categories_income') : t('categories_expense')}
                </Badge>
              ),
            },
            {
              key: 'actions',
              header: '',
              align: 'right',
              className: 'w-px !px-2',
              render: (r) => (
                <div className="flex items-center justify-end gap-1">
                  <div className="relative group">
                    <button
                      onClick={() => openEdit(r)}
                      className="cursor-pointer p-1.5 rounded hover:bg-[var(--bg-border)] text-[var(--text-muted)] hover:text-[var(--accent)] transition-colors"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <span className="pointer-events-none absolute -top-8 right-0 whitespace-nowrap rounded px-2 py-1 text-xs bg-[var(--bg-elevated)] border border-[var(--bg-border)] text-[var(--text-secondary)] opacity-0 group-hover:opacity-100 transition-opacity z-10">
                      {t('categories_edit')}
                    </span>
                  </div>
                  <div className="relative group">
                    <button
                      onClick={() => openDelete(r)}
                      className="cursor-pointer p-1.5 rounded hover:bg-[var(--bg-border)] text-[var(--text-muted)] hover:text-[var(--danger)] transition-colors"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                    <span className="pointer-events-none absolute -top-8 right-0 whitespace-nowrap rounded px-2 py-1 text-xs bg-[var(--bg-elevated)] border border-[var(--bg-border)] text-[var(--text-secondary)] opacity-0 group-hover:opacity-100 transition-opacity z-10">
                      {t('categories_delete')}
                    </span>
                  </div>
                </div>
              ),
            },
          ]}
        />
      </Card>

      {/* Create / Edit modal */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? t('categories_editTitle') : t('categories_createTitle')}
        size="sm"
      >
        <div className="flex flex-col gap-4">
          <Input
            label={t('categories_name')}
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          />
          <div>
            <label className="block text-xs font-medium text-[var(--text-muted)] mb-2">{t('categories_type')}</label>
            <div className="flex gap-2">
              {(['income', 'expense'] as const).map((t_) => (
                <button
                  key={t_}
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, type: t_ }))}
                  className={`flex-1 py-1.5 rounded text-sm font-medium transition-colors cursor-pointer ${
                    form.type === t_
                      ? t_ === 'income'
                        ? 'bg-[var(--success)] text-white'
                        : 'bg-[var(--danger)] text-white'
                      : 'bg-[var(--bg-elevated)] text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
                  }`}
                >
                  {t_ === 'income' ? t('categories_income') : t('categories_expense')}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-[var(--text-muted)] mb-2">{t('categories_color')}</label>
            <ColorPicker value={form.color} onChange={(c) => setForm((f) => ({ ...f, color: c }))} />
          </div>
          {save.isError && (
            <p className="text-xs text-[var(--danger)]">
              {(save.error as Error)?.message ?? t('categories_saveError')}
            </p>
          )}
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="ghost" onClick={() => setModalOpen(false)}>{t('settings_cancel')}</Button>
            <Button onClick={() => save.mutate()} loading={save.isPending} disabled={!form.name.trim()}>
              {t('categories_save')}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Delete confirm dialog */}
      <Modal
        open={!!deleting}
        onClose={() => setDeleting(null)}
        title={t('categories_deleteTitle')}
        size="sm"
      >
        {usageCount === null ? (
          <div className="flex justify-center py-4">
            <div className="h-5 w-5 border-2 border-[var(--accent)] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {usageCount > 0 ? (
              <>
                <p className="text-sm text-[var(--text-secondary)]">
                  {t('categories_deleteUsed').replace('{count}', String(usageCount))}
                </p>
                <Select
                  label={t('categories_transferTo')}
                  placeholder={t('categories_transferNone')}
                  value={transferTo}
                  onChange={setTransferTo}
                  options={otherCategories.map((c) => ({ value: c.id, label: c.name }))}
                />
              </>
            ) : (
              <p className="text-sm text-[var(--text-secondary)]">{t('categories_deleteConfirm')}</p>
            )}
            {remove.isError && (
              <p className="text-xs text-[var(--danger)]">
                {(remove.error as Error)?.message ?? t('categories_deleteError')}
              </p>
            )}
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setDeleting(null)}>{t('settings_cancel')}</Button>
              <Button variant="danger" onClick={() => remove.mutate()} loading={remove.isPending}>
                {t('categories_delete')}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}

// ── Banks tab ─────────────────────────────────────────────────

type BankForm = { name: string; agency: string; account_number: string; account_type: 'checking' | 'savings' }
const EMPTY_BANK: BankForm = { name: '', agency: '', account_number: '', account_type: 'checking' }

function BanksTab() {
  const t = useT()
  const activeCompany = useAuthStore((s) => s.activeCompany)
  const qc = useQueryClient()

  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Bank | null>(null)
  const [form, setForm] = useState<BankForm>(EMPTY_BANK)
  const [deleteId, setDeleteId] = useState<string | null>(null)

  const { data: banks = [], isLoading } = useQuery<Bank[]>({
    queryKey: ['banks', activeCompany?.id],
    queryFn: () => getBanks(activeCompany!.id),
    enabled: !!activeCompany?.id,
  })

  const openCreate = () => { setEditing(null); setForm(EMPTY_BANK); setModalOpen(true) }
  const openEdit = (b: Bank) => {
    setEditing(b)
    setForm({ name: b.name, agency: b.agency ?? '', account_number: b.account_number ?? '', account_type: b.account_type })
    setModalOpen(true)
  }

  const save = useMutation({
    mutationFn: async () => {
      const payload = {
        name: form.name,
        agency: form.agency || undefined,
        account_number: form.account_number || undefined,
        account_type: form.account_type,
      }
      if (editing) return updateBank(editing.id, payload)
      return createBank({ company_id: activeCompany!.id, ...payload })
    },
    onSuccess: () => { setModalOpen(false); qc.invalidateQueries({ queryKey: ['banks', activeCompany?.id] }) },
  })

  const remove = useMutation({
    mutationFn: (id: string) => deleteBank(id),
    onSuccess: () => { setDeleteId(null); qc.invalidateQueries({ queryKey: ['banks', activeCompany?.id] }) },
  })

  const f = (key: keyof BankForm) => (e: ChangeEvent<HTMLInputElement>) =>
    setForm((prev) => ({ ...prev, [key]: e.target.value }))

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end">
        <Button size="sm" onClick={openCreate}>
          <Plus className="h-4 w-4" />
          {t('banks_new')}
        </Button>
      </div>

      <Card padding="sm">
        <Table
          loading={isLoading}
          data={banks}
          rowKey={(r) => r.id}
          emptyMessage={t('banks_empty')}
          columns={[
            {
              key: 'name',
              header: t('banks_name'),
              render: (r) => <span className="text-sm font-medium text-[var(--text-primary)]">{r.name}</span>,
            },
            {
              key: 'agency',
              header: t('banks_agency'),
              render: (r) => <span className="text-sm text-[var(--text-secondary)]">{r.agency ?? '—'}</span>,
            },
            {
              key: 'account_number',
              header: t('banks_accountNumber'),
              render: (r) => <span className="text-sm text-[var(--text-secondary)]">{r.account_number ?? '—'}</span>,
            },
            {
              key: 'account_type',
              header: t('banks_accountType'),
              render: (r) => (
                <span className="text-sm text-[var(--text-secondary)]">
                  {r.account_type === 'checking' ? t('banks_checking') : t('banks_savings')}
                </span>
              ),
            },
            {
              key: 'actions',
              header: '',
              align: 'right',
              className: 'w-px !px-2',
              render: (r) => (
                <div className="flex items-center justify-end gap-1">
                  <div className="relative group">
                    <button
                      onClick={() => openEdit(r)}
                      className="cursor-pointer p-1.5 rounded hover:bg-[var(--bg-border)] text-[var(--text-muted)] hover:text-[var(--accent)] transition-colors"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <span className="pointer-events-none absolute -top-8 right-0 whitespace-nowrap rounded px-2 py-1 text-xs bg-[var(--bg-elevated)] border border-[var(--bg-border)] text-[var(--text-secondary)] opacity-0 group-hover:opacity-100 transition-opacity z-10">
                      {t('categories_edit')}
                    </span>
                  </div>
                  <div className="relative group">
                    <button
                      onClick={() => setDeleteId(r.id)}
                      className="cursor-pointer p-1.5 rounded hover:bg-[var(--bg-border)] text-[var(--text-muted)] hover:text-[var(--danger)] transition-colors"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                    <span className="pointer-events-none absolute -top-8 right-0 whitespace-nowrap rounded px-2 py-1 text-xs bg-[var(--bg-elevated)] border border-[var(--bg-border)] text-[var(--text-secondary)] opacity-0 group-hover:opacity-100 transition-opacity z-10">
                      {t('categories_delete')}
                    </span>
                  </div>
                </div>
              ),
            },
          ]}
        />
      </Card>

      {/* Create / Edit modal */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? t('banks_editTitle') : t('banks_createTitle')} size="sm">
        <div className="flex flex-col gap-4">
          <Input label={t('banks_name')} value={form.name} onChange={f('name')} />
          <div className="grid grid-cols-2 gap-3">
            <Input label={t('banks_agency')} value={form.agency} onChange={f('agency')} />
            <Input label={t('banks_accountNumber')} value={form.account_number} onChange={f('account_number')} />
          </div>
          <div>
            <label className="block text-xs font-medium text-[var(--text-muted)] mb-2">{t('banks_accountType')}</label>
            <div className="flex gap-2">
              {(['checking', 'savings'] as const).map((at) => (
                <button
                  key={at}
                  type="button"
                  onClick={() => setForm((p) => ({ ...p, account_type: at }))}
                  className={`flex-1 py-1.5 rounded text-sm font-medium transition-colors cursor-pointer ${
                    form.account_type === at
                      ? 'bg-[var(--accent)] text-white'
                      : 'bg-[var(--bg-elevated)] text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
                  }`}
                >
                  {at === 'checking' ? t('banks_checking') : t('banks_savings')}
                </button>
              ))}
            </div>
          </div>
          {save.isError && (
            <p className="text-xs text-[var(--danger)]">{(save.error as Error)?.message}</p>
          )}
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="ghost" onClick={() => setModalOpen(false)}>{t('settings_cancel')}</Button>
            <Button onClick={() => save.mutate()} loading={save.isPending} disabled={!form.name.trim()}>
              {t('banks_save')}
            </Button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={() => remove.mutate(deleteId!)}
        title={t('banks_deleteTitle')}
        message={t('banks_deleteConfirm')}
        confirmLabel={t('categories_delete')}
        loading={remove.isPending}
      />
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
          <Tab id="categories">{t('settings_categories')}</Tab>
          <Tab id="banks">{t('settings_banks')}</Tab>
        </TabList>
        <TabPanel id="company"><CompanyTab /></TabPanel>
        <TabPanel id="members"><MembersTab /></TabPanel>
        <TabPanel id="accountant"><AccountantTab /></TabPanel>
        <TabPanel id="categories"><CategoriesTab /></TabPanel>
        <TabPanel id="banks"><BanksTab /></TabPanel>
      </Tabs>
    </div>
  )
}
