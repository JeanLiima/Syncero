import { useEffect, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Lock, Pencil, CheckCircle2, FileKey2, Upload, Trash2, RefreshCw } from 'lucide-react'
import { apiFetch } from '@/lib/api'
import { Button, Card, ConfirmDialog, Input, Modal, Select, Tabs, TabList, Tab, TabPanel, useToast } from '@syncero/ui'
import { useCompanyContext } from '@/hooks/useCompanyContext'
import { getCompanyTaxSettings, saveCompanyTaxSettings, getSefazCredentialBooks, saveSefazCredentialBooks, deleteSefazCredentialBooks, triggerSefazSyncBooks, type SefazCredentialBooks } from '@/lib/backend'
import { useT } from '@/i18n'
import { maskCnpj, stripCnpj, validateCnpj } from '@/lib/cnpj'
import type { ExternalCompany, TaxRegime, CompanySegment } from '@/types'

// ── helpers ───────────────────────────────────────────────────


function useTaxRegimeOptions(t: ReturnType<typeof import('@/i18n').useT>) {
  return [
    { value: 'simples',         label: t('settings_simplesNacional') },
    { value: 'lucro_presumido', label: t('settings_lucroPresumido') },
    { value: 'lucro_real',      label: t('settings_lucroReal') },
  ]
}

function useSegmentOptions(t: ReturnType<typeof import('@/i18n').useT>) {
  return [
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
}

function taxLabel(regime: string | null | undefined, t: (k: any) => string) {
  if (regime === 'simples')         return t('settings_simplesNacional')
  if (regime === 'lucro_presumido') return t('settings_lucroPresumido')
  if (regime === 'lucro_real')      return t('settings_lucroReal')
  return '—'
}

function fmt(cnpj: string | null | undefined) {
  return cnpj ? maskCnpj(cnpj) : '—'
}

function InfoRow({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="flex items-center justify-between px-4 py-3">
      <span className="text-sm text-[var(--text-muted)]">{label}</span>
      <span className="text-sm font-medium text-[var(--text-primary)]">{value || '—'}</span>
    </div>
  )
}

// ── ISS rate input (reusable inside modals) ───────────────────

function IssRateInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const t = useT()
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-medium text-[var(--text-secondary)]">{t('settings_issRate')}</label>
      <div className="flex items-center gap-1.5 h-10 px-3 rounded-[var(--radius-md)] bg-[var(--bg-elevated)] border border-[var(--bg-border)] focus-within:border-[var(--accent)] transition-colors">
        <input
          type="text" inputMode="decimal"
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder="0"
          className="flex-1 bg-transparent text-sm text-[var(--text-primary)] text-right outline-none font-mono min-w-0"
        />
        <span className="text-sm text-[var(--text-muted)] shrink-0">%</span>
      </div>
      <p className="text-xs text-[var(--text-muted)]">{t('settings_issRatePlaceholder')}</p>
    </div>
  )
}

function fmtIss(rate: number | null | undefined) {
  if (rate == null) return undefined
  return `${(rate * 100).toFixed(2).replace('.', ',')}%`
}

// ── External company (editable) ───────────────────────────────

function ExternalCompanySettings({ id }: { id: string }) {
  const t = useT()
  const taxRegimeOptions = useTaxRegimeOptions(t)
  const segmentOptions   = useSegmentOptions(t)
  const segmentLabel     = Object.fromEntries(segmentOptions.filter(o => o.value).map(o => [o.value, o.label]))
  const qc = useQueryClient()
  const { success, error: toastError } = useToast()
  const [editOpen, setEditOpen] = useState(false)

  const { data: company } = useQuery({
    queryKey: ['external-company', id],
    queryFn: () => apiFetch<ExternalCompany & { iss_rate?: number | null }>(`/api/external-companies/${id}`),
    enabled: !!id,
  })

  const [name,      setName]      = useState('')
  const [tradeName, setTradeName] = useState('')
  const [cnpj,      setCnpj]      = useState('')
  const [cnpjError, setCnpjError] = useState('')
  const [taxRegime, setTaxRegime] = useState<TaxRegime | ''>('')
  const [segment,   setSegment]   = useState<CompanySegment | ''>('')
  const [issRaw,    setIssRaw]    = useState('')
  const [saving,    setSaving]    = useState(false)

  useEffect(() => {
    if (!company) return
    setName(company.name ?? '')
    setTradeName(company.trade_name ?? '')
    setCnpj(company.cnpj ? maskCnpj(company.cnpj) : '')
    setTaxRegime(company.tax_regime ?? '')
    setSegment(company.segment ?? '')
    setIssRaw(company.iss_rate != null ? String(company.iss_rate * 100) : '')
  }, [company])

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (cnpj && !validateCnpj(cnpj)) { setCnpjError(t('common_cnpjInvalid')); return }
    setSaving(true)
    try {
      const iss = issRaw.trim() === '' ? null : parseFloat(issRaw.replace(',', '.')) / 100
      await apiFetch(`/api/external-companies/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          name:       name.trim() || undefined,
          trade_name: tradeName.trim() || null,
          cnpj:       stripCnpj(cnpj) || null,
          tax_regime: taxRegime || null,
          segment:    segment   || null,
          iss_rate:   iss,
        }),
      })
      qc.invalidateQueries({ queryKey: ['external-company', id] })
      qc.invalidateQueries({ queryKey: ['external-companies'] })
      success(t('settings_saved'))
      setEditOpen(false)
    } catch {
      toastError(t('settings_errorSave'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <div className="flex flex-col gap-5">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium text-[var(--text-secondary)]">{t('settings_companyInfo')}</h2>
          <Button variant="ghost" size="sm" onClick={() => setEditOpen(true)}>
            <Pencil className="h-3.5 w-3.5" />
            {t('settings_edit')}
          </Button>
        </div>

        <div className="flex flex-col divide-y divide-[var(--bg-border)] rounded-[var(--radius-lg)] border border-[var(--bg-border)] overflow-hidden">
          <InfoRow label={t('settings_name')}      value={company?.name} />
          <InfoRow label={t('settings_tradeName')} value={company?.trade_name} />
          <InfoRow label={t('settings_cnpj')}      value={fmt(company?.cnpj)} />
          <InfoRow label={t('settings_taxRegime')} value={taxLabel(company?.tax_regime, t)} />
          <InfoRow label={t('settings_segment')}   value={company?.segment ? segmentLabel[company.segment] : undefined} />
          <InfoRow label={t('settings_issRate')}   value={fmtIss(company?.iss_rate)} />
        </div>
      </div>

      <Modal open={editOpen} onClose={() => setEditOpen(false)} title={t('settings_editCompany')} size="sm">
        <form onSubmit={handleSave} className="flex flex-col gap-4">
          <Input label={t('settings_name')} value={name} onChange={e => setName(e.target.value)} />
          <Input label={t('settings_tradeName')} value={tradeName} onChange={e => setTradeName(e.target.value)} />
          <Input
            label={t('settings_cnpj')} placeholder="00.000.000/0000-00"
            value={cnpj}
            onChange={(e) => { setCnpj(maskCnpj(e.target.value)); setCnpjError('') }}
            onBlur={() => { if (cnpj && !validateCnpj(cnpj)) setCnpjError(t('common_cnpjInvalid')) }}
            maxLength={18} error={cnpjError}
          />
          <Select
            label={t('settings_taxRegime')}
            options={[{ value: '', label: t('settings_taxRegimeUndefined') }, ...taxRegimeOptions]}
            value={taxRegime} onChange={v => setTaxRegime(v as TaxRegime | '')}
          />
          <Select
            label={t('settings_segment')} options={segmentOptions} searchable
            value={segment} onChange={v => setSegment(v as CompanySegment | '')}
          />
          <IssRateInput value={issRaw} onChange={setIssRaw} />
          <div className="flex items-center justify-end gap-3 mt-2 pt-4 border-t border-[var(--bg-border)]">
            <Button variant="ghost" size="sm" type="button" onClick={() => setEditOpen(false)}>
              {t('settings_cancel')}
            </Button>
            <Button type="submit" loading={saving}>{t('settings_save')}</Button>
          </div>
        </form>
      </Modal>
    </>
  )
}

// ── Integrated company (read-only from Flow, fiscal data editable) ──

function IntegratedCompanySettings({ id }: { id: string }) {
  const t = useT()
  const qc = useQueryClient()
  const segmentOptions = useSegmentOptions(t)
  const segmentLabel   = Object.fromEntries(segmentOptions.filter(o => o.value).map(o => [o.value, o.label]))
  const { success, error: toastError } = useToast()

  const [editOpen, setEditOpen] = useState(false)
  const [issRaw,   setIssRaw]   = useState('')
  const [saving,   setSaving]   = useState(false)

  const { data: company } = useQuery({
    queryKey: ['company-readonly', id],
    queryFn: () => apiFetch<{ id: string; name: string; cnpj: string | null; tax_regime: TaxRegime | null; segment: CompanySegment | null }>(`/api/companies/${id}`),
    enabled: !!id,
  })

  const { data: taxSettings } = useQuery({
    queryKey: ['company-tax-settings', id],
    queryFn: () => getCompanyTaxSettings(id),
    enabled: !!id,
  })

  const openEdit = () => {
    setIssRaw(taxSettings?.iss_rate != null ? String(taxSettings.iss_rate * 100) : '')
    setEditOpen(true)
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      const iss = issRaw.trim() === '' ? null : parseFloat(issRaw.replace(',', '.')) / 100
      await saveCompanyTaxSettings(id, { issRate: iss })
      qc.invalidateQueries({ queryKey: ['company-tax-settings', id] })
      success(t('settings_saved'))
      setEditOpen(false)
    } catch {
      toastError(t('settings_errorSave'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium text-[var(--text-secondary)]">{t('settings_companyInfo')}</h2>
        <Button variant="ghost" size="sm" onClick={openEdit}>
          <Pencil className="h-3.5 w-3.5" />
          {t('settings_edit')}
        </Button>
      </div>

      <div className="flex items-center gap-2 rounded-[var(--radius-md)] border border-[var(--bg-border)] bg-[var(--bg-elevated)] px-3 py-2">
        <Lock className="h-3.5 w-3.5 text-[var(--text-muted)] shrink-0" />
        <p className="text-xs text-[var(--text-muted)]">{t('settings_readOnly')}</p>
      </div>

      <div className="flex flex-col divide-y divide-[var(--bg-border)] rounded-[var(--radius-lg)] border border-[var(--bg-border)] overflow-hidden">
        <InfoRow label={t('settings_name')}      value={company?.name} />
        <InfoRow label={t('settings_cnpj')}      value={fmt(company?.cnpj)} />
        <InfoRow label={t('settings_taxRegime')} value={taxLabel(company?.tax_regime, t)} />
        <InfoRow label={t('settings_segment')}   value={company?.segment ? segmentLabel[company.segment] : undefined} />
        <InfoRow label={t('settings_issRate')}   value={fmtIss(taxSettings?.iss_rate)} />
      </div>

      <Modal open={editOpen} onClose={() => setEditOpen(false)} title={t('settings_editCompany')} size="sm">
        <form onSubmit={handleSave} className="flex flex-col gap-4">
          <IssRateInput value={issRaw} onChange={setIssRaw} />
          <div className="flex items-center justify-end gap-3 mt-2 pt-4 border-t border-[var(--bg-border)]">
            <Button variant="ghost" size="sm" type="button" onClick={() => setEditOpen(false)}>
              {t('settings_cancel')}
            </Button>
            <Button type="submit" loading={saving}>{t('settings_save')}</Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}

// ── Aba Certificados ──────────────────────────────────────────

const UF_OPTIONS = [
  { value: '12', label: 'AC' }, { value: '27', label: 'AL' }, { value: '16', label: 'AP' },
  { value: '13', label: 'AM' }, { value: '29', label: 'BA' }, { value: '23', label: 'CE' },
  { value: '53', label: 'DF' }, { value: '32', label: 'ES' }, { value: '52', label: 'GO' },
  { value: '21', label: 'MA' }, { value: '51', label: 'MT' }, { value: '50', label: 'MS' },
  { value: '31', label: 'MG' }, { value: '15', label: 'PA' }, { value: '25', label: 'PB' },
  { value: '41', label: 'PR' }, { value: '26', label: 'PE' }, { value: '22', label: 'PI' },
  { value: '33', label: 'RJ' }, { value: '24', label: 'RN' }, { value: '43', label: 'RS' },
  { value: '11', label: 'RO' }, { value: '14', label: 'RR' }, { value: '42', label: 'SC' },
  { value: '35', label: 'SP' }, { value: '28', label: 'SE' }, { value: '17', label: 'TO' },
].map(u => ({ ...u, label: `${u.label} — ${u.label}` }))

// versão mais descritiva para o select
const UF_OPTIONS_FULL = [
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

void UF_OPTIONS // keep import

function CertificatesTab({ companyId, extCompanyId }: { companyId?: string; extCompanyId?: string }) {
  const t  = useT()
  const qc = useQueryClient()
  const { success, error: toastError } = useToast()
  const entityParams = companyId ? { companyId } : { extCompanyId: extCompanyId! }

  const fileRef = useRef<HTMLInputElement>(null)
  const [modalOpen,   setModalOpen]   = useState(false)
  const [certFile,    setCertFile]    = useState<File | null>(null)
  const [password,    setPassword]    = useState('')
  const [environment, setEnvironment] = useState<'production' | 'homologation'>('production')
  const [ufCode,      setUfCode]      = useState('')
  const [revokeOpen,  setRevokeOpen]  = useState(false)

  const queryKey = ['sefaz-credential-books', companyId ?? extCompanyId]

  const { data: credential, isLoading } = useQuery<SefazCredentialBooks | null>({
    queryKey,
    queryFn: () => getSefazCredentialBooks({ companyId, extCompanyId }),
    enabled: !!(companyId || extCompanyId),
  })

  function closeModal() { setModalOpen(false); setCertFile(null); setPassword(''); setUfCode('') }

  const save = useMutation({
    mutationFn: () => {
      if (!certFile || (!companyId && !extCompanyId)) throw new Error('missing')
      const form = new FormData()
      if (companyId)    form.append('company_id',    companyId)
      if (extCompanyId) form.append('ext_company_id', extCompanyId)
      form.append('cert',           certFile)
      form.append('password',       password)
      form.append('environment',    environment)
      form.append('uf_code',        ufCode)
      return saveSefazCredentialBooks(form)
    },
    onSuccess: () => {
      success(t('sefaz_uploadSuccess'))
      closeModal()
      qc.invalidateQueries({ queryKey })
    },
    onError: () => toastError(t('sefaz_uploadError')),
  })

  const revoke = useMutation({
    mutationFn: () => deleteSefazCredentialBooks(entityParams),
    onSuccess: () => {
      setRevokeOpen(false)
      success(t('common_deletedSuccess'))
      qc.invalidateQueries({ queryKey })
    },
    onError: () => toastError(t('common_errorGeneric')),
  })

  const sync = useMutation({
    mutationFn: () => triggerSefazSyncBooks({ companyId, extCompanyId }),
    onSuccess: () => {
      success(t('sefaz_syncSuccess'))
      qc.invalidateQueries({ queryKey })
      qc.invalidateQueries({ queryKey: ['fiscal-docs'] })
    },
    onError: () => toastError(t('sefaz_syncError')),
  })

  const canSave = certFile && password && ufCode && !save.isPending

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-32">
        <div className="h-5 w-5 border-2 border-[var(--accent)] border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Botão topo — quando cert já existe, para substituir */}
      {credential && (
        <div className="flex justify-end">
          <Button size="sm" onClick={() => setModalOpen(true)}>
            <FileKey2 className="h-3.5 w-3.5" />
            {t('sefaz_addCert')}
          </Button>
        </div>
      )}

      <Card padding="sm">
        {credential ? (
          /* ── Cert ativo ── */
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
                    {UF_OPTIONS_FULL.find(u => u.value === credential.uf_code)?.label ?? credential.uf_code}
                  </p>
                </div>
              </div>
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
            <Button size="sm" onClick={() => setModalOpen(true)}>
              <FileKey2 className="h-3.5 w-3.5" />
              {t('sefaz_addCert')}
            </Button>
          </div>
        )}
      </Card>

      {/* Modal de upload */}
      <Modal
          open={modalOpen}
          onClose={closeModal}
          title={t('sefaz_uploadTitle')}
          size="md"
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
                type="password" value={password} onChange={e => setPassword(e.target.value)} autoComplete="off"
                className="w-full h-9 px-3 rounded-[var(--radius-md)] border border-[var(--bg-border)] bg-[var(--bg-base)] text-sm text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:border-transparent"
              />
            </div>
            <Select
              label={t('sefaz_uploadUf')}
              options={UF_OPTIONS_FULL}
              value={ufCode}
              onChange={setUfCode}
              placeholder="—"
              searchable
              searchPlaceholder="Buscar estado…"
            />
            <div>
              <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">{t('sefaz_uploadEnvironment')}</label>
              <div className="flex gap-2">
                {(['production', 'homologation'] as const).map(env => (
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

// ── Page ──────────────────────────────────────────────────────

export function Component() {
  const t = useT()
  const { id, isExternal, companyId, extCompanyId } = useCompanyContext()

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-semibold text-[var(--text-primary)]">{t('settings_company')}</h1>
      <Tabs defaultTab="company">
        <TabList>
          <Tab id="company">{t('settings_company')}</Tab>
          <Tab id="certificates">{t('settings_certificates')}</Tab>
        </TabList>
        <TabPanel id="company">
          <div className="pt-6">
            {isExternal
              ? <ExternalCompanySettings id={id} />
              : <IntegratedCompanySettings id={id} />
            }
          </div>
        </TabPanel>
        <TabPanel id="certificates">
          <div className="pt-6">
            <CertificatesTab companyId={companyId} extCompanyId={extCompanyId} />
          </div>
        </TabPanel>
      </Tabs>
    </div>
  )
}
