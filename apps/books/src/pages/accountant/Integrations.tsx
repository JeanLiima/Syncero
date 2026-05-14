import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { ShieldOff, AlertCircle, RefreshCw } from 'lucide-react'
import { Card, useToast } from '@syncero/ui'
import { useCompanyContext } from '@/hooks/useCompanyContext'
import { useT } from '@/i18n'
import { getSefazCredentialBooks, toggleSefazBooks, triggerSefazSyncBooks } from '@/lib/backend'

// ── Switch ────────────────────────────────────────────────────────────────────

function Switch({ checked, onChange, disabled }: { checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => !disabled && onChange(!checked)}
      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] ${
        checked ? 'bg-[var(--accent)]' : 'bg-[var(--bg-border)]'
      } ${disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}`}
    >
      <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform duration-200 ${
        checked ? 'translate-x-6' : 'translate-x-1'
      }`} />
    </button>
  )
}

// ── Card de integração SEFAZ ──────────────────────────────────────────────────

function SefazIntegrationCard({ companyId, extCompanyId }: { companyId?: string; extCompanyId?: string }) {
  const t        = useT()
  const navigate = useNavigate()
  const qc       = useQueryClient()
  const { error: toastError, success } = useToast()
  const basePath = companyId
    ? `/accountant/company/${companyId}`
    : `/accountant/external/${extCompanyId}`

  const queryKey = ['sefaz-credential-books', companyId ?? extCompanyId]

  const { data: credential, isLoading } = useQuery({
    queryKey,
    queryFn:  () => getSefazCredentialBooks({ companyId, extCompanyId }),
    enabled:  !!(companyId || extCompanyId),
  })

  const toggle = useMutation({
    mutationFn: (active: boolean) => toggleSefazBooks({ companyId, extCompanyId }, active),
    onSuccess: () => qc.invalidateQueries({ queryKey }),
    onError:   () => toastError(t('common_errorGeneric')),
  })

  const sync = useMutation({
    mutationFn: () => triggerSefazSyncBooks({ companyId, extCompanyId }),
    onSuccess: () => {
      success(t('sefaz_syncSuccess'))
      qc.invalidateQueries({ queryKey })
    },
    onError: () => toastError(t('sefaz_syncError')),
  })

  const hasCert   = !!credential
  const isActive  = hasCert && credential.is_active
  const canToggle = hasCert && !toggle.isPending

  function formatDate(iso: string | null | undefined) {
    if (!iso) return null
    return new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
  }

  return (
    <Card padding="md">
      <div className="flex items-start gap-4">
        {/* Icon */}
        <div className={`h-10 w-10 rounded-xl flex items-center justify-center shrink-0 ${
          isActive ? 'bg-[var(--accent)]/10' : 'bg-[var(--bg-elevated)]'
        }`}>
          <ShieldOff className={`h-5 w-5 ${isActive ? 'text-[var(--accent)]' : 'text-[var(--text-muted)]'}`} />
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold text-[var(--text-primary)]">{t('integrations_sefaz_name')}</p>
            {!isLoading && (
              <span className={`text-xs font-medium px-1.5 py-0.5 rounded-full ${
                isActive
                  ? 'bg-green-500/10 text-green-600'
                  : 'bg-[var(--bg-elevated)] text-[var(--text-muted)]'
              }`}>
                {isActive ? t('integrations_enabled') : t('integrations_disabled')}
              </span>
            )}
          </div>
          <p className="text-xs text-[var(--text-muted)] mt-0.5">{t('integrations_sefaz_desc')}</p>

          {/* Sem certificado */}
          {!isLoading && !hasCert && (
            <button
              onClick={() => navigate(`${basePath}/settings`)}
              className="mt-2 flex items-center gap-1.5 text-xs text-[var(--text-muted)] hover:text-[var(--accent)] transition-colors cursor-pointer"
            >
              <AlertCircle className="h-3.5 w-3.5 shrink-0" />
              {t('integrations_sefaz_noCert')}
              {' '}
              <span className="underline underline-offset-2">{t('integrations_sefaz_configureCert')}</span>
            </button>
          )}

          {/* Sync info */}
          {isActive && (
            <div className="mt-2 flex items-center gap-4 text-xs text-[var(--text-muted)]">
              <span>
                {t('sefaz_lastSync')}:{' '}
                <span className="text-[var(--text-primary)] font-medium">
                  {formatDate(credential.last_sync_at) ?? t('sefaz_neverSynced')}
                </span>
              </span>
              {credential.last_error && (
                <span className="text-red-500 truncate max-w-xs">{credential.last_error}</span>
              )}
              <button
                onClick={() => sync.mutate()}
                disabled={sync.isPending}
                className="flex items-center gap-1 text-[var(--accent)] hover:opacity-80 transition-opacity cursor-pointer disabled:opacity-40"
              >
                <RefreshCw className={`h-3 w-3 ${sync.isPending ? 'animate-spin' : ''}`} />
                {sync.isPending ? t('sefaz_syncing') : t('sefaz_syncNow')}
              </button>
            </div>
          )}
        </div>

        {/* Toggle */}
        {!isLoading && (
          <Switch
            checked={isActive}
            onChange={(v) => toggle.mutate(v)}
            disabled={!canToggle}
          />
        )}
      </div>
    </Card>
  )
}

// ── Página ────────────────────────────────────────────────────────────────────

export function Component() {
  const t = useT()
  const { companyId, extCompanyId } = useCompanyContext()

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-semibold text-[var(--text-primary)]">{t('settings_integrations')}</h1>
      <SefazIntegrationCard companyId={companyId} extCompanyId={extCompanyId} />
    </div>
  )
}
