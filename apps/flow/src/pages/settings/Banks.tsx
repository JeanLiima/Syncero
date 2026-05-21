import { useState } from 'react'
import { Pencil, Trash2, Plus, Link, Unlink, RefreshCw, Wifi } from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Button, Card, Table, ConfirmDialog, useToast, IconButton, Badge } from '@syncero/ui'
import { useAuthStore } from '@/store/auth'
import { useT } from '@/i18n'
import { getBanks, deleteBank, getPluggyConnectToken, connectPluggyBank, disconnectPluggyBank, syncPluggyBank } from '@/lib/backend'
import { BankFormModal } from '@/modules/banks/BankFormModal'
import { apiError } from '@/i18n'
import type { Bank } from '@/types'

// ── Pluggy Connect Widget via CDN dinâmico ──────────────────────

declare global {
  interface Window {
    PluggyConnect?: new (config: {
      connectToken: string
      onSuccess: (data: { item: { id: string } }) => void
      onError: (error: unknown) => void
      onClose: () => void
    }) => { init: () => void }
  }
}

function loadPluggyScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.PluggyConnect) { resolve(); return }
    const existing = document.getElementById('pluggy-connect-script')
    if (existing) { existing.addEventListener('load', () => resolve()); return }
    const script = document.createElement('script')
    script.id = 'pluggy-connect-script'
    script.src = 'https://cdn.pluggy.ai/pluggy-connect/v2.1.0/pluggy-connect.js'
    script.onload = () => resolve()
    script.onerror = () => reject(new Error('pluggy_script_load_failed'))
    document.head.appendChild(script)
  })
}

// ── Componente principal ───────────────────────────────────────

export function Component() {
  const t = useT()
  const { success, error: toastError } = useToast()
  const activeCompany = useAuthStore((s) => s.activeCompany)
  const canWrite = activeCompany?.role !== 'viewer'
  const qc = useQueryClient()

  const [modalOpen, setModalOpen]       = useState(false)
  const [editing, setEditing]           = useState<Bank | null>(null)
  const [deleteId, setDeleteId]         = useState<string | null>(null)
  const [disconnectId, setDisconnectId] = useState<string | null>(null)
  const [connectingId, setConnectingId] = useState<string | null>(null)
  const [syncingId, setSyncingId]       = useState<string | null>(null)

  const { data: banks = [], isLoading } = useQuery<Bank[]>({
    queryKey: ['banks', activeCompany?.id],
    queryFn: () => getBanks(activeCompany!.id),
    enabled: !!activeCompany?.id,
  })

  const openCreate = () => { setEditing(null); setModalOpen(true) }
  const openEdit   = (b: Bank) => { setEditing(b); setModalOpen(true) }

  const invalidate = () => qc.invalidateQueries({ queryKey: ['banks', activeCompany?.id] })

  const remove = useMutation({
    mutationFn: (id: string) => deleteBank(id),
    onSuccess: () => { setDeleteId(null); invalidate(); success(t('common_deletedSuccess')) },
    onError: () => toastError(t('common_errorGeneric')),
  })

  const disconnect = useMutation({
    mutationFn: (bankId: string) => disconnectPluggyBank(bankId),
    onSuccess: () => { setDisconnectId(null); invalidate(); success(t('banks_disconnectSuccess')) },
    onError: () => toastError(t('common_errorGeneric')),
  })

  const handleConnect = async (bank: Bank) => {
    setConnectingId(bank.id)
    try {
      await loadPluggyScript()
      const { accessToken } = await getPluggyConnectToken()

      const connect = new window.PluggyConnect!({
        connectToken: accessToken,
        onSuccess: async ({ item }) => {
          try {
            await connectPluggyBank(bank.id, item.id)
            invalidate()
            success(t('banks_connectSuccess'))
          } catch {
            toastError(t('common_errorGeneric'))
          } finally {
            setConnectingId(null)
          }
        },
        onError: () => {
          toastError(t('common_errorGeneric'))
          setConnectingId(null)
        },
        onClose: () => setConnectingId(null),
      })
      connect.init()
    } catch (err) {
      toastError(apiError(err, t, 'common_errorGeneric'))
      setConnectingId(null)
    }
  }

  const handleSync = async (bank: Bank) => {
    setSyncingId(bank.id)
    try {
      const { imported } = await syncPluggyBank(bank.id)
      invalidate()
      if (imported > 0) {
        success(t('banks_syncSuccess').replace('{{count}}', String(imported)))
      } else {
        success(t('banks_syncNone'))
      }
    } catch (err) {
      toastError(apiError(err, t, 'common_errorGeneric'))
    } finally {
      setSyncingId(null)
    }
  }

  const formatLastSync = (date: string | null) => {
    if (!date) return null
    return t('banks_lastSync').replace(
      '{{date}}',
      new Date(date).toLocaleDateString(undefined, { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }),
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-[var(--text-primary)]">{t('settings_banks')}</h1>
        {canWrite && (
          <Button size="sm" onClick={openCreate}>
            <Plus className="h-4 w-4" />
            {t('banks_new')}
          </Button>
        )}
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
              render: (r) => (
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-[var(--text-primary)]">{r.name}</span>
                  {r.pluggy_item_id && (
                    <Badge variant="success">
                      <Wifi className="h-2.5 w-2.5 mr-1" />
                      {t('banks_connected')}
                    </Badge>
                  )}
                </div>
              ),
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
              key: 'sync',
              header: 'Sync',
              render: (r) => r.last_synced_at
                ? <span className="text-xs text-[var(--text-muted)]">{formatLastSync(r.last_synced_at)}</span>
                : null,
            },
            ...(canWrite ? [{
              key: 'actions',
              header: '',
              align: 'right' as const,
              className: 'w-px !px-2',
              render: (r: Bank) => (
                <div className="flex items-center justify-end gap-1">
                  {r.pluggy_item_id ? (
                    <>
                      <IconButton
                        icon={<RefreshCw className={`h-3.5 w-3.5 ${syncingId === r.id ? 'animate-spin' : ''}`} />}
                        tooltip={t('banks_sync')}
                        onClick={() => handleSync(r)}
                        disabled={syncingId === r.id}
                      />
                      <IconButton
                        icon={<Unlink className="h-3.5 w-3.5" />}
                        tooltip={t('banks_disconnect')}
                        variant="danger"
                        onClick={() => setDisconnectId(r.id)}
                      />
                    </>
                  ) : (
                    <IconButton
                      icon={<Link className={`h-3.5 w-3.5 ${connectingId === r.id ? 'opacity-50' : ''}`} />}
                      tooltip={t('banks_connect')}
                      onClick={() => handleConnect(r)}
                      disabled={connectingId === r.id}
                    />
                  )}
                  <IconButton icon={<Pencil className="h-3.5 w-3.5" />} tooltip={t('categories_edit')} onClick={() => openEdit(r)} />
                  <IconButton icon={<Trash2 className="h-3.5 w-3.5" />} tooltip={t('categories_delete')} variant="danger" onClick={() => setDeleteId(r.id)} />
                </div>
              ),
            }] : []),
          ]}
        />
      </Card>

      <BankFormModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        editing={editing}
        onSaved={() => { setModalOpen(false); invalidate() }}
      />

      <ConfirmDialog
        open={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={() => remove.mutate(deleteId!)}
        title={t('banks_deleteTitle')}
        message={t('banks_deleteConfirm')}
        confirmLabel={t('categories_delete')}
        loading={remove.isPending}
      />

      <ConfirmDialog
        open={!!disconnectId}
        onClose={() => setDisconnectId(null)}
        onConfirm={() => disconnect.mutate(disconnectId!)}
        title={t('banks_disconnectTitle')}
        message={t('banks_disconnectConfirm')}
        confirmLabel={t('banks_disconnect')}
        loading={disconnect.isPending}
      />
    </div>
  )
}
