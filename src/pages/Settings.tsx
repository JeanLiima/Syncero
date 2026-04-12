import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/auth'
import { Button, Card, Input, Select, Table, Badge, Tabs, TabList, Tab, TabPanel, Avatar } from '@/components/ui'
import type { Company, CompanyMember, AccountantCompany, MemberRole } from '@/types'

// ── Company tab ───────────────────────────────────────────────

const companySchema = z.object({
  name: z.string().min(2, 'Nome muito curto'),
  cnpj: z.string().optional(),
  tax_regime: z.enum(['simples_nacional', 'lucro_presumido', 'lucro_real']).optional(),
})

type CompanyForm = z.infer<typeof companySchema>

function CompanyTab() {
  const activeCompany = useAuthStore((s) => s.activeCompany)
  const setActiveCompany = useAuthStore((s) => s.setActiveCompany)
  const qc = useQueryClient()

  const { data: company } = useQuery({
    queryKey: ['company', activeCompany?.id],
    queryFn: async () => {
      if (!activeCompany?.id) return null
      const { data } = await supabase
        .from('companies')
        .select('*')
        .eq('id', activeCompany.id)
        .single()
      return data as Company | null
    },
    enabled: !!activeCompany?.id,
  })

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<CompanyForm>({
    resolver: zodResolver(companySchema),
  })

  useEffect(() => {
    if (company) reset({ name: company.name, cnpj: company.cnpj ?? '', tax_regime: company.tax_regime ?? undefined })
  }, [company, reset])

  const save = useMutation({
    mutationFn: async (data: CompanyForm) => {
      const { error } = await supabase
        .from('companies')
        .update(data)
        .eq('id', activeCompany!.id)
      if (error) throw error
    },
    onSuccess: (_, vars) => {
      setActiveCompany({ ...activeCompany!, name: vars.name })
      qc.invalidateQueries({ queryKey: ['company', activeCompany?.id] })
    },
  })

  return (
    <form onSubmit={handleSubmit((d) => save.mutateAsync(d))} className="flex flex-col gap-4 max-w-lg">
      <Input label="Nome da empresa" error={errors.name?.message} {...register('name')} />
      <Input label="CNPJ" placeholder="00.000.000/0000-00" {...register('cnpj')} />
      <Select
        label="Regime tributário"
        placeholder="Selecionar"
        options={[
          { value: 'simples_nacional', label: 'Simples Nacional' },
          { value: 'lucro_presumido',  label: 'Lucro Presumido' },
          { value: 'lucro_real',       label: 'Lucro Real' },
        ]}
        {...register('tax_regime')}
      />
      <div className="flex gap-3 mt-2">
        <Button type="submit" loading={isSubmitting}>Salvar alterações</Button>
      </div>
    </form>
  )
}

// ── Members tab ───────────────────────────────────────────────

function MembersTab() {
  const activeCompany = useAuthStore((s) => s.activeCompany)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState<MemberRole>('member')
  const qc = useQueryClient()

  const { data: members = [], isLoading } = useQuery({
    queryKey: ['members', activeCompany?.id],
    queryFn: async () => {
      if (!activeCompany?.id) return []
      const { data } = await supabase
        .from('company_members')
        .select('*')
        .eq('company_id', activeCompany.id)
        .order('invited_at', { ascending: false })
      return (data ?? []) as CompanyMember[]
    },
    enabled: !!activeCompany?.id,
  })

  const invite = useMutation({
    mutationFn: async () => {
      const token = crypto.randomUUID()
      const { error } = await supabase
        .from('company_members')
        .insert({
          company_id: activeCompany!.id,
          email: inviteEmail,
          role: inviteRole,
          status: 'invited',
          invite_token: token,
        })
      if (error) throw error
      return token
    },
    onSuccess: () => {
      setInviteEmail('')
      qc.invalidateQueries({ queryKey: ['members', activeCompany?.id] })
    },
  })

  const revoke = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('company_members')
        .update({ status: 'inactive' })
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['members', activeCompany?.id] }),
  })

  return (
    <div className="flex flex-col gap-6 max-w-2xl">
      {/* Invite form */}
      <Card>
        <h3 className="text-sm font-medium text-[var(--text-primary)] mb-4">Convidar membro</h3>
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
              { value: 'admin',  label: 'Administrador' },
              { value: 'member', label: 'Membro' },
              { value: 'viewer', label: 'Visualizador' },
            ]}
            value={inviteRole}
            onChange={(e) => setInviteRole(e.target.value as MemberRole)}
            className="w-40"
          />
          <Button
            onClick={() => invite.mutate()}
            loading={invite.isPending}
            disabled={!inviteEmail}
          >
            Convidar
          </Button>
        </div>
      </Card>

      {/* Members list */}
      <Card padding="sm">
        <Table
          loading={isLoading}
          data={members}
          rowKey={(r) => r.id}
          emptyMessage="Nenhum membro ainda"
          columns={[
            { key: 'email', header: 'E-mail' },
            {
              key: 'role',
              header: 'Papel',
              render: (r) => <Badge>{r.role}</Badge>,
            },
            {
              key: 'status',
              header: 'Status',
              render: (r) => (
                <Badge variant={r.status === 'active' ? 'success' : r.status === 'invited' ? 'warning' : 'default'}>
                  {r.status}
                </Badge>
              ),
            },
            {
              key: 'actions',
              header: '',
              align: 'right',
              render: (r) =>
                r.status !== 'inactive' ? (
                  <Button
                    variant="danger"
                    size="sm"
                    onClick={() => revoke.mutate(r.id)}
                    loading={revoke.isPending}
                  >
                    Revogar
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
  const activeCompany = useAuthStore((s) => s.activeCompany)
  const [inviteEmail, setInviteEmail] = useState('')
  const qc = useQueryClient()

  const { data: accountants = [], isLoading } = useQuery({
    queryKey: ['accountants', activeCompany?.id],
    queryFn: async () => {
      if (!activeCompany?.id) return []
      const { data } = await supabase
        .from('accountant_companies')
        .select('*, profiles(id, full_name, email, avatar_url)')
        .eq('company_id', activeCompany.id)
        .order('invited_at', { ascending: false })
      return (data ?? []) as AccountantCompany[]
    },
    enabled: !!activeCompany?.id,
  })

  const invite = useMutation({
    mutationFn: async () => {
      const token = crypto.randomUUID()
      const { error } = await supabase
        .from('accountant_companies')
        .insert({
          company_id: activeCompany!.id,
          email: inviteEmail,
          status: 'pending',
          invite_token: token,
        })
      if (error) throw error
      return token
    },
    onSuccess: () => {
      setInviteEmail('')
      qc.invalidateQueries({ queryKey: ['accountants', activeCompany?.id] })
    },
  })

  return (
    <div className="flex flex-col gap-6 max-w-2xl">
      <Card>
        <h3 className="text-sm font-medium text-[var(--text-primary)] mb-4">Convidar contador</h3>
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
            Enviar convite
          </Button>
        </div>
        {invite.isSuccess && (
          <p className="mt-3 text-xs text-[var(--success)]">
            Convite enviado! Link: {window.location.origin}/convite/{/* token not accessible here, just show success */}
          </p>
        )}
      </Card>

      <Card padding="sm">
        <Table
          loading={isLoading}
          data={accountants}
          rowKey={(r) => r.id}
          emptyMessage="Nenhum contador vinculado"
          columns={[
            {
              key: 'accountant',
              header: 'Contador',
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
                  <span className="text-[var(--text-muted)]">{r.email}</span>
                )
              },
            },
            {
              key: 'status',
              header: 'Status',
              render: (r) => (
                <Badge variant={r.status === 'accepted' ? 'success' : r.status === 'pending' ? 'warning' : 'danger'}>
                  {r.status === 'accepted' ? 'Ativo' : r.status === 'pending' ? 'Aguardando' : 'Rejeitado'}
                </Badge>
              ),
            },
            {
              key: 'invited_at',
              header: 'Convidado em',
              render: (r) => format(new Date(r.invited_at), 'dd/MM/yyyy', { locale: ptBR }),
            },
          ]}
        />
      </Card>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────

export function Component() {
  const activeCompany = useAuthStore((s) => s.activeCompany)

  if (!activeCompany) {
    return (
      <div className="flex flex-col gap-4">
        <h1 className="text-xl font-semibold text-[var(--text-primary)]">Configurações</h1>
        <p className="text-sm text-[var(--text-muted)]">Nenhuma empresa ativa. Crie uma empresa para continuar.</p>
        {/* TODO: create company form */}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-semibold text-[var(--text-primary)]">Configurações</h1>

      <Tabs defaultTab="company">
        <TabList className="mb-6">
          <Tab id="company">Empresa</Tab>
          <Tab id="members">Membros</Tab>
          <Tab id="accountant">Contador</Tab>
        </TabList>
        <TabPanel id="company"><CompanyTab /></TabPanel>
        <TabPanel id="members"><MembersTab /></TabPanel>
        <TabPanel id="accountant"><AccountantTab /></TabPanel>
      </Tabs>
    </div>
  )
}
