import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { ShieldOff, AlertCircle } from 'lucide-react'
import { Card, useToast } from '@syncero/ui'
import { useAuthStore } from '@/store/auth'
import { useT } from '@/i18n'
import { getSefazCredential, toggleSefazIntegration, type SefazCredential } from '@/lib/backend'

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

function SefazIntegrationCard({ companyId, isAdmin }: { companyId: string; isAdmin: boolean }) {
  const t        = useT()
  const navigate = useNavigate()
  const qc       = useQueryClient()
  const { error: toastError } = useToast()

  const { data: credential, isLoading } = useQuery<SefazCredential | null>({
    queryKey: ['sefaz-credential', companyId],
    queryFn:  () => getSefazCredential(companyId),
    enabled:  !!companyId && isAdmin,
  })

  const toggle = useMutation({
    mutationFn: (active: boolean) => toggleSefazIntegration(companyId, active),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['sefaz-credential', companyId] }),
    onError:   () => toastError(t('common_errorGeneric')),
  })

  const hasCert   = !!credential
  const isActive  = hasCert && credential.is_active
  const canToggle = isAdmin && hasCert && !toggle.isPending

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

          {/* Estado do certificado */}
          {!isLoading && !hasCert && (
            <div className="mt-3 flex items-start gap-2 rounded-lg bg-[var(--warning)]/10 border border-[var(--warning)]/25 px-3 py-2.5">
              <AlertCircle className="h-3.5 w-3.5 shrink-0 text-[var(--warning)] mt-px" />
              <p className="text-xs text-[var(--warning)] leading-snug">
                {t('integrations_sefaz_noCert')}{' '}
                <button
                  onClick={() => navigate('/settings/company')}
                  className="underline underline-offset-2 cursor-pointer hover:opacity-80 transition-opacity"
                >
                  {t('integrations_sefaz_configureCert')}
                </button>
              </p>
            </div>
          )}

          {/* Sync info */}
          {isActive && (
            <div className="mt-2 flex items-center gap-4 text-xs text-[var(--text-muted)]">
              <span>{t('sefaz_lastSync')}: <span className="text-[var(--text-primary)] font-medium">{formatDate(credential.last_sync_at) ?? t('sefaz_neverSynced')}</span></span>
              {credential.last_error && (
                <span className="text-red-500 truncate max-w-xs">{credential.last_error}</span>
              )}
            </div>
          )}
        </div>

        {/* Toggle */}
        {isAdmin && !isLoading && (
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
  const t             = useT()
  const activeCompany = useAuthStore((s) => s.activeCompany)
  const isAdmin       = activeCompany?.role === 'admin'

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-semibold text-[var(--text-primary)]">{t('settings_integrations')}</h1>

      <SefazIntegrationCard companyId={activeCompany?.id ?? ''} isAdmin={isAdmin} />
    </div>
  )
}
