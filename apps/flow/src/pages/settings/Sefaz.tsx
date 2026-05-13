import { useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CheckCircle2, RefreshCw, Trash2, Upload, AlertCircle, FileKey2 } from 'lucide-react'
import { Button, Card, ConfirmDialog, useToast } from '@syncero/ui'
import { useAuthStore } from '@/store/auth'
import { useT } from '@/i18n'
import {
  getCompany,
  getSefazCredential,
  saveSefazCredential,
  deleteSefazCredential,
  triggerSefazSync,
  type SefazCredential,
} from '@/lib/backend'

const UF_OPTIONS = [
  { value: '12', label: 'AC — Acre' },
  { value: '27', label: 'AL — Alagoas' },
  { value: '16', label: 'AP — Amapá' },
  { value: '13', label: 'AM — Amazonas' },
  { value: '29', label: 'BA — Bahia' },
  { value: '23', label: 'CE — Ceará' },
  { value: '53', label: 'DF — Distrito Federal' },
  { value: '32', label: 'ES — Espírito Santo' },
  { value: '52', label: 'GO — Goiás' },
  { value: '21', label: 'MA — Maranhão' },
  { value: '51', label: 'MT — Mato Grosso' },
  { value: '50', label: 'MS — Mato Grosso do Sul' },
  { value: '31', label: 'MG — Minas Gerais' },
  { value: '15', label: 'PA — Pará' },
  { value: '25', label: 'PB — Paraíba' },
  { value: '41', label: 'PR — Paraná' },
  { value: '26', label: 'PE — Pernambuco' },
  { value: '22', label: 'PI — Piauí' },
  { value: '33', label: 'RJ — Rio de Janeiro' },
  { value: '24', label: 'RN — Rio Grande do Norte' },
  { value: '43', label: 'RS — Rio Grande do Sul' },
  { value: '11', label: 'RO — Rondônia' },
  { value: '14', label: 'RR — Roraima' },
  { value: '42', label: 'SC — Santa Catarina' },
  { value: '35', label: 'SP — São Paulo' },
  { value: '28', label: 'SE — Sergipe' },
  { value: '17', label: 'TO — Tocantins' },
]

function formatDate(iso: string | null | undefined) {
  if (!iso) return null
  return new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
}

export function Component() {
  const t             = useT()
  const { success, error: toastError } = useToast()
  const activeCompany = useAuthStore((s) => s.activeCompany)
  const isAdmin       = activeCompany?.role === 'admin'
  const qc            = useQueryClient()

  const fileRef = useRef<HTMLInputElement>(null)
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

  const hasCnpj = !!company?.cnpj

  const { data: credential, isLoading } = useQuery<SefazCredential | null>({
    queryKey: ['sefaz-credential', activeCompany?.id],
    queryFn:  () => getSefazCredential(activeCompany!.id),
    enabled:  !!activeCompany?.id && isAdmin,
  })

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
      setCertFile(null)
      setPassword('')
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

  const canSave = certFile && password && ufCode && !save.isPending

  if (!isAdmin) return null

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-[var(--text-primary)]">{t('sefaz_title')}</h1>
        <p className="mt-1 text-sm text-[var(--text-muted)]">{t('sefaz_subtitle')}</p>
      </div>

      {!hasCnpj && (
        <Card padding="md">
          <div className="flex items-center gap-3 text-[var(--text-muted)]">
            <AlertCircle className="h-5 w-5 shrink-0" />
            <p className="text-sm">{t('sefaz_noCnpj')}</p>
          </div>
        </Card>
      )}

      {hasCnpj && !isLoading && credential && (
        <Card padding="md">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-lg bg-green-500/10 flex items-center justify-center shrink-0">
                <CheckCircle2 className="h-5 w-5 text-green-500" />
              </div>
              <div>
                <p className="text-sm font-medium text-[var(--text-primary)]">{t('sefaz_active')}</p>
                <p className="text-xs text-[var(--text-muted)] mt-0.5">
                  {credential.environment === 'production' ? t('sefaz_uploadEnvironmentProd') : t('sefaz_uploadEnvironmentHomol')}
                  {' · '}
                  {UF_OPTIONS.find((u) => u.value === credential.uf_code)?.label ?? credential.uf_code}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => sync.mutate()}
                disabled={sync.isPending}
              >
                <RefreshCw className={`h-3.5 w-3.5 ${sync.isPending ? 'animate-spin' : ''}`} />
                {sync.isPending ? t('sefaz_syncing') : t('sefaz_syncNow')}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setRevokeOpen(true)}>
                <Trash2 className="h-3.5 w-3.5" />
                {t('sefaz_revoke')}
              </Button>
            </div>
          </div>

          <div className="mt-4 pt-4 border-t border-[var(--bg-border)] grid grid-cols-2 gap-4 text-xs">
            <div>
              <p className="text-[var(--text-muted)]">{t('sefaz_lastSync')}</p>
              <p className="text-[var(--text-primary)] mt-0.5 font-medium">
                {formatDate(credential.last_sync_at) ?? t('sefaz_neverSynced')}
              </p>
            </div>
            {credential.last_error && (
              <div>
                <p className="text-[var(--text-muted)]">{t('sefaz_lastError')}</p>
                <p className="text-red-500 mt-0.5 font-medium line-clamp-2">{credential.last_error}</p>
              </div>
            )}
          </div>
        </Card>
      )}

      {hasCnpj && !isLoading && !credential && (
        <Card padding="md">
          <h2 className="text-sm font-semibold text-[var(--text-primary)] mb-4">{t('sefaz_uploadTitle')}</h2>

          <div className="flex flex-col gap-4">
            {/* Arquivo .pfx */}
            <div>
              <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">
                {t('sefaz_uploadCert')}
              </label>
              <input
                ref={fileRef}
                type="file"
                accept=".pfx,.p12"
                className="hidden"
                onChange={(e) => setCertFile(e.target.files?.[0] ?? null)}
              />
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="w-full h-20 rounded-[var(--radius-md)] border-2 border-dashed border-[var(--bg-border)] flex flex-col items-center justify-center gap-1.5 text-[var(--text-muted)] hover:border-[var(--accent)] hover:text-[var(--accent)] transition-colors cursor-pointer"
              >
                {certFile ? (
                  <>
                    <FileKey2 className="h-5 w-5" />
                    <span className="text-xs font-medium">{certFile.name}</span>
                  </>
                ) : (
                  <>
                    <Upload className="h-5 w-5" />
                    <span className="text-xs">{t('sefaz_clickToSelect')}</span>
                  </>
                )}
              </button>
              <p className="text-xs text-[var(--text-muted)] mt-1">{t('sefaz_uploadCertHint')}</p>
            </div>

            {/* Senha */}
            <div>
              <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">
                {t('sefaz_uploadPassword')}
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="off"
                className="w-full h-9 px-3 rounded-[var(--radius-md)] border border-[var(--bg-border)] bg-[var(--bg-base)] text-sm text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:border-transparent"
              />
            </div>

            {/* UF */}
            <div>
              <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">
                {t('sefaz_uploadUf')}
              </label>
              <select
                value={ufCode}
                onChange={(e) => setUfCode(e.target.value)}
                className="w-full h-9 px-3 rounded-[var(--radius-md)] border border-[var(--bg-border)] bg-[var(--bg-base)] text-sm text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:border-transparent"
              >
                <option value="">—</option>
                {UF_OPTIONS.map((u) => (
                  <option key={u.value} value={u.value}>{u.label}</option>
                ))}
              </select>
              <p className="text-xs text-[var(--text-muted)] mt-1">{t('sefaz_uploadUfHint')}</p>
            </div>

            {/* Ambiente */}
            <div>
              <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">
                {t('sefaz_uploadEnvironment')}
              </label>
              <div className="flex gap-2">
                {(['production', 'homologation'] as const).map((env) => (
                  <button
                    key={env}
                    type="button"
                    onClick={() => setEnvironment(env)}
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

            <Button
              className="self-start"
              onClick={() => save.mutate()}
              disabled={!canSave}
            >
              {save.isPending ? t('sefaz_uploadSaving') : t('sefaz_uploadSave')}
            </Button>
          </div>
        </Card>
      )}

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
