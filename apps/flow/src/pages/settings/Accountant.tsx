import { useState } from 'react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { RefreshCw, X, UserMinus, UserPlus } from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Button, Card, Input, Modal, Table, Badge, Avatar, ConfirmDialog, useToast, IconButton } from '@syncero/ui'
import { useAuthStore } from '@/store/auth'
import { usePreferencesStore } from '@/store/preferences'
import { useT } from '@/i18n'
import { getAccountantCompanies, inviteAccountant, resendAccountantInvite, cancelAccountantInvite } from '@/lib/backend'
import type { AccountantCompany } from '@/types'

export function Component() {
  const t = useT()
  const { success, error: toastError } = useToast()
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
      qc.invalidateQueries({ queryKey: ['accountants', activeCompany?.id] })
      success(t('common_deletedSuccess'))
    },
    onError: () => toastError(t('common_errorGeneric')),
  })

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-semibold text-[var(--text-primary)]">{t('settings_accountant')}</h1>

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
                    <IconButton
                      icon={<RefreshCw className={`h-3.5 w-3.5 ${resend.isPending && resend.variables === r.id ? 'animate-spin' : ''}`} />}
                      tooltip={t('settings_resend')}
                      onClick={() => resend.mutate(r.id)}
                      disabled={resend.isPending && resend.variables === r.id}
                    />
                    <IconButton
                      icon={<X className="h-3.5 w-3.5" />}
                      tooltip={t('settings_cancel')}
                      variant="danger"
                      onClick={() => cancel.mutate(r.id)}
                      disabled={cancel.isPending && cancel.variables === r.id}
                    />
                  </div>
                )

                if (r.status === 'accepted') return (
                  <IconButton
                    icon={<UserMinus className="h-3.5 w-3.5" />}
                    tooltip={t('settings_unlink')}
                    variant="danger"
                    onClick={() => setUnlinkId(r.id)}
                    disabled={unlink.isPending && unlink.variables === r.id}
                  />
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
