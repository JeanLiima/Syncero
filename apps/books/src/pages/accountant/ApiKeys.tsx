import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus, ShieldOff, Trash2 } from 'lucide-react'
import { apiFetch } from '@/lib/api'
import { useCompanyContext } from '@/hooks/useCompanyContext'
import { Button, Card, ConfirmDialog, SkeletonRows, useToast, IconButton } from '@syncero/ui'
import { ApiKeyCreateModal } from '@/components/accountant/ApiKeyCreateModal'
import { useT } from '@/i18n'
import type { ApiKey } from '@/types'

export function Component() {
  const t = useT()
  const { id, isExternal } = useCompanyContext()
  const qc = useQueryClient()
  const [createOpen, setCreateOpen] = useState(false)

  const { success: toastSuccess, error: toastError } = useToast()
  const [revokeTarget, setRevokeTarget] = useState<ApiKey | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<ApiKey | null>(null)
  const [acting, setActing] = useState(false)

  const queryKey = ['api-keys', id]
  const companyParam = isExternal ? `ext_company_id=${id}` : `company_id=${id}`

  const { data: keys = [], isLoading } = useQuery({
    queryKey,
    queryFn: () => apiFetch<ApiKey[]>(`/api/api-keys?${companyParam}`),
    enabled: !!id,
  })

  const handleCreate = async (data: { name: string; expiresAt: string | null }): Promise<string> => {
    const result = await apiFetch<{ key: string }>('/api/api-keys', {
      method: 'POST',
      body: JSON.stringify({
        name: data.name,
        expires_at: data.expiresAt,
        ...(isExternal ? { ext_company_id: id } : { company_id: id }),
      }),
    })
    qc.invalidateQueries({ queryKey })
    return result.key
  }

  const handleRevoke = async () => {
    if (!revokeTarget) return
    setActing(true)
    try {
      await apiFetch(`/api/api-keys/${revokeTarget.id}/revoke`, { method: 'PATCH', body: '{}' })
      qc.invalidateQueries({ queryKey })
      toastSuccess(t('apiKeys_revokeSuccess'))
      setRevokeTarget(null)
    } catch {
      toastError(t('apiKeys_revokeError'))
    } finally {
      setActing(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    setActing(true)
    try {
      await apiFetch(`/api/api-keys/${deleteTarget.id}`, { method: 'DELETE' })
      qc.invalidateQueries({ queryKey })
      toastSuccess(t('apiKeys_deleteSuccess'))
      setDeleteTarget(null)
    } catch {
      toastError(t('apiKeys_deleteError'))
    } finally {
      setActing(false)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-[var(--text-primary)]">{t('apiKeys_title')}</h1>
        <Button size="sm" onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4" />
          {t('apiKeys_new')}
        </Button>
      </div>

      <div className="p-4 rounded-[var(--radius-md)] bg-[var(--bg-elevated)] border border-[var(--bg-border)] text-sm text-[var(--text-secondary)]">
        <p className="font-medium text-[var(--text-primary)] mb-1">{t('apiKeys_howTo')}</p>
        <p><code className="font-mono text-xs bg-[var(--bg-surface)] px-1 py-0.5 rounded">Authorization: Bearer &lt;key&gt;</code> — {t('apiKeys_howToDesc')}</p>
      </div>

      {isLoading ? (
        <Card className="p-0 overflow-hidden">
          <table className="w-full text-sm">
            <tbody><SkeletonRows rows={3} cols={6} /></tbody>
          </table>
        </Card>
      ) : keys.length === 0 ? (
        <Card>
          <div className="flex flex-col items-center gap-3 py-8 text-center">
            <p className="text-sm text-[var(--text-muted)]">{t('apiKeys_empty')}</p>
          </div>
        </Card>
      ) : (
        <Card className="p-0 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--bg-border)] text-left">
                <th className="px-4 py-3 text-xs font-medium text-[var(--text-muted)]">{t('apiKeys_name')}</th>
                <th className="px-4 py-3 text-xs font-medium text-[var(--text-muted)]">{t('apiKeys_prefix')}</th>
                <th className="px-4 py-3 text-xs font-medium text-[var(--text-muted)]">{t('apiKeys_lastUsed')}</th>
                <th className="px-4 py-3 text-xs font-medium text-[var(--text-muted)]">{t('apiKeys_expiresAt')}</th>
                <th className="px-4 py-3 text-xs font-medium text-[var(--text-muted)]">{t('apiKeys_status')}</th>
                <th className="px-4 py-3 w-16" />
              </tr>
            </thead>
            <tbody>
              {keys.map((key) => (
                <tr key={key.id} className="border-b border-[var(--bg-border)]/50 hover:bg-[var(--bg-elevated)] transition-colors group">
                  <td className="px-4 py-3 text-[var(--text-primary)] font-medium">{key.name}</td>
                  <td className="px-4 py-3 font-mono text-xs text-[var(--text-secondary)]">{key.key_prefix}…</td>
                  <td className="px-4 py-3 text-xs text-[var(--text-muted)]">
                    {key.last_used_at ? new Date(key.last_used_at).toLocaleDateString('pt-BR') : '—'}
                  </td>
                  <td className="px-4 py-3 text-xs text-[var(--text-muted)]">
                    {key.expires_at ? new Date(key.expires_at).toLocaleDateString('pt-BR') : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-1.5 py-0.5 rounded ${
                      key.is_active
                        ? 'bg-[var(--success)]/15 text-[var(--success)]'
                        : 'bg-[var(--bg-elevated)] text-[var(--text-muted)]'
                    }`}>
                      {key.is_active ? t('apiKeys_active') : t('apiKeys_revoked')}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      {key.is_active ? (
                        <IconButton
                          icon={<ShieldOff className="h-3.5 w-3.5" />}
                          tooltip={t('apiKeys_revokeHint')}
                          variant="warning"
                          onClick={() => setRevokeTarget(key)}
                        />
                      ) : (
                        <IconButton
                          icon={<Trash2 className="h-3.5 w-3.5" />}
                          tooltip={t('apiKeys_deleteHint')}
                          variant="danger"
                          onClick={() => setDeleteTarget(key)}
                        />
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {/* Confirmação — Revogar */}
      <ConfirmDialog
        open={!!revokeTarget}
        onClose={() => setRevokeTarget(null)}
        onConfirm={handleRevoke}
        title={t('apiKeys_revokeConfirmTitle')}
        message={`"${revokeTarget?.name}" — ${t('apiKeys_revokeConfirmMsg')}`}
        confirmLabel={t('apiKeys_revokeConfirmYes')}
        loading={acting}
      />

      {/* Confirmação — Excluir */}
      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title={t('apiKeys_deleteConfirmTitle')}
        message={`"${deleteTarget?.name}" — ${t('apiKeys_deleteConfirmMsg')}`}
        confirmLabel={t('apiKeys_deleteConfirmYes')}
        loading={acting}
      />

      <ApiKeyCreateModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreate={handleCreate}
      />
    </div>
  )
}
