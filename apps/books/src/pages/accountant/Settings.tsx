import { useEffect, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Lock, Pencil } from 'lucide-react'
import { apiFetch } from '@/lib/api'
import { Button, Input, Modal, Select, useToast } from '@syncero/ui'
import { useCompanyContext } from '@/hooks/useCompanyContext'
import { useT } from '@/i18n'
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
  return cnpj ? cnpj.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5') : '—'
}

function InfoRow({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="flex items-center justify-between px-4 py-3">
      <span className="text-sm text-[var(--text-muted)]">{label}</span>
      <span className="text-sm font-medium text-[var(--text-primary)]">{value || '—'}</span>
    </div>
  )
}

// ── External company (editable) ───────────────────────────────

function ExternalCompanySettings({ id }: { id: string }) {
  const t = useT()
  const taxRegimeOptions = useTaxRegimeOptions(t)
  const segmentOptions = useSegmentOptions(t)
  const segmentLabel = Object.fromEntries(segmentOptions.filter(o => o.value).map(o => [o.value, o.label]))
  const qc = useQueryClient()
  const { success, error: toastError } = useToast()
  const [editOpen, setEditOpen] = useState(false)

  const { data: company } = useQuery({
    queryKey: ['external-company', id],
    queryFn: () => apiFetch<ExternalCompany>(`/api/external-companies/${id}`),
    enabled: !!id,
  })

  const [name,      setName]      = useState('')
  const [tradeName, setTradeName] = useState('')
  const [cnpj,      setCnpj]      = useState('')
  const [taxRegime, setTaxRegime] = useState<TaxRegime | ''>('')
  const [segment,   setSegment]   = useState<CompanySegment | ''>('')
  const [saving,    setSaving]    = useState(false)

  useEffect(() => {
    if (!company) return
    setName(company.name ?? '')
    setTradeName(company.trade_name ?? '')
    setCnpj(company.cnpj ?? '')
    setTaxRegime((company.tax_regime as TaxRegime) ?? '')
    setSegment((company.segment as CompanySegment) ?? '')
  }, [company])

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      await apiFetch(`/api/external-companies/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          name:       name.trim() || undefined,
          trade_name: tradeName.trim() || null,
          cnpj:       cnpj.replace(/\D/g, '') || null,
          tax_regime: taxRegime || null,
          segment:    segment   || null,
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
        </div>
      </div>

      <Modal open={editOpen} onClose={() => setEditOpen(false)} title={t('settings_editCompany')} size="sm">
        <form onSubmit={handleSave} className="flex flex-col gap-4">
          <Input
            label={t('settings_name')}
            value={name}
            onChange={e => setName(e.target.value)}
          />
          <Input
            label={t('settings_tradeName')}
            value={tradeName}
            onChange={e => setTradeName(e.target.value)}
          />
          <Input
            label={t('settings_cnpj')}
            placeholder="00.000.000/0000-00"
            value={cnpj}
            onChange={e => setCnpj(e.target.value)}
            maxLength={18}
          />
          <Select
            label={t('settings_taxRegime')}
            options={[{ value: '', label: t('settings_taxRegimeUndefined') }, ...taxRegimeOptions]}
            value={taxRegime}
            onChange={v => setTaxRegime(v as TaxRegime | '')}
          />
          <Select
            label={t('settings_segment')}
            options={segmentOptions}
            value={segment}
            onChange={v => setSegment(v as CompanySegment | '')}
            searchable
          />
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

// ── Integrated company (read-only) ────────────────────────────

function IntegratedCompanySettings({ id }: { id: string }) {
  const t = useT()

  const { data: company } = useQuery({
    queryKey: ['company-readonly', id],
    queryFn: () => apiFetch<{ id: string; name: string; cnpj: string | null; tax_regime: string | null }>(`/api/companies/${id}`),
    enabled: !!id,
  })

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium text-[var(--text-secondary)]">{t('settings_companyInfo')}</h2>
      </div>

      <div className="flex items-center gap-2 rounded-[var(--radius-md)] border border-[var(--bg-border)] bg-[var(--bg-elevated)] px-3 py-2">
        <Lock className="h-3.5 w-3.5 text-[var(--text-muted)] shrink-0" />
        <p className="text-xs text-[var(--text-muted)]">{t('settings_readOnly')}</p>
      </div>

      <div className="flex flex-col divide-y divide-[var(--bg-border)] rounded-[var(--radius-lg)] border border-[var(--bg-border)] overflow-hidden">
        <InfoRow label={t('settings_name')}      value={company?.name} />
        <InfoRow label={t('settings_cnpj')}      value={fmt(company?.cnpj)} />
        <InfoRow label={t('settings_taxRegime')} value={taxLabel(company?.tax_regime, t)} />
      </div>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────

export function Component() {
  const t = useT()
  const { id, isExternal } = useCompanyContext()

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-semibold text-[var(--text-primary)]">{t('settings_company')}</h1>
      {isExternal
        ? <ExternalCompanySettings id={id} />
        : <IntegratedCompanySettings id={id} />
      }
    </div>
  )
}
