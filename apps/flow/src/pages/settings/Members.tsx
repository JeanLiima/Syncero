import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Button, Card, Input, Select, Table, Badge, useToast } from '@syncero/ui'
import { useAuthStore } from '@/store/auth'
import { useT } from '@/i18n'
import { getCompanyMembers, inviteCompanyMember, removeCompanyMember } from '@/lib/backend'
import type { MemberRole } from '@/types'

export function Component() {
  const t = useT()
  const { success, error: toastError } = useToast()
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
    },
    onSuccess: () => {
      setInviteEmail('')
      qc.invalidateQueries({ queryKey: ['members', activeCompany?.id] })
      success(t('common_inviteSent'))
    },
    onError: () => toastError(t('common_errorGeneric')),
  })

  const revoke = useMutation({
    mutationFn: async (id: string) => { await removeCompanyMember(id) },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['members', activeCompany?.id] })
      success(t('common_deletedSuccess'))
    },
    onError: () => toastError(t('common_errorGeneric')),
  })

  return (
    <div className="flex flex-col gap-6 max-w-2xl">
      <h1 className="text-xl font-semibold text-[var(--text-primary)]">{t('settings_members')}</h1>

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
          <Button onClick={() => invite.mutate()} loading={invite.isPending} disabled={!inviteEmail}>
            {t('settings_invite')}
          </Button>
        </div>
        {invite.isError && (
          <p className="text-xs text-[var(--danger)] mt-2">
            {(invite.error as Error)?.message ?? t('settings_inviteError')}
          </p>
        )}
      </Card>

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
                  <Button variant="danger" size="sm" onClick={() => revoke.mutate(r.id)} loading={revoke.isPending}>
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
