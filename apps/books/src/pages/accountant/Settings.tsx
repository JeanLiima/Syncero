import { useState, useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Lock } from 'lucide-react'
import { apiFetch } from '@/lib/api'
import { Button, Card, Input, Select } from '@syncero/ui'
import { useCompanyContext } from '@/hooks/useCompanyContext'
import { useT } from '@/i18n'
import type { ExternalCompany, TaxRegime, CompanySegment } from '@/types'

const taxRegimeOptions = [
  { value: '', label: '— Não definido —' },
  { value: 'simples', label: 'Simples Nacional' },
  { value: 'lucro_presumido', label: 'Lucro Presumido' },
  { value: 'lucro_real', label: 'Lucro Real' },
]

const segmentOptions = [
  { value: '', label: '— Não definido —' },
  { value: 'comercio', label: 'Comércio' },
  { value: 'servicos', label: 'Serviços' },
  { value: 'industria', label: 'Indústria' },
  { value: 'construcao_civil', label: 'Construção Civil' },
  { value: 'agronegocio', label: 'Agronegócio' },
  { value: 'saude', label: 'Saúde' },
  { value: 'educacao', label: 'Educação' },
  { value: 'tecnologia', label: 'Tecnologia' },
  { value: 'financeiro', label: 'Financeiro' },
  { value: 'outros', label: 'Outros' },
]

const taxRegimeLabel: Record<string, string> = {
  simples: 'Simples Nacional',
  lucro_presumido: 'Lucro Presumido',
  lucro_real: 'Lucro Real',
}

function ReadOnlyRow({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs font-medium text-[var(--text-secondary)]">{label}</span>
      <span className="text-sm text-[var(--text-primary)]">{value}</span>
    </div>
  )
}

export function Component() {
  const t = useT()
  const qc = useQueryClient()
  const { id, isExternal, canWrite } = useCompanyContext()

  // External company data
  const { data: extCompany } = useQuery({
    queryKey: ['external-company', id],
    queryFn: () => apiFetch<ExternalCompany>(`/api/external-companies/${id}`),
    enabled: isExternal && !!id,
  })

  // Integrated company data
  const { data: intCompany } = useQuery({
    queryKey: ['company-readonly', id],
    queryFn: () => apiFetch<{ id: string; name: string; cnpj: string | null; tax_regime: string | null }>(`/api/companies/${id}`),
    enabled: !isExternal && !!id,
  })

  const [name,      setName]      = useState('')
  const [tradeName, setTradeName] = useState('')
  const [cnpj,      setCnpj]      = useState('')
  const [taxRegime, setTaxRegime] = useState<TaxRegime | ''>('')
  const [segment,   setSegment]   = useState<CompanySegment | ''>('')

  const [saving,  setSaving]  = useState(false)
  const [saved,   setSaved]   = useState(false)
  const [error,   setError]   = useState<string | null>(null)

  useEffect(() => {
    if (!extCompany) return
    setName(extCompany.name ?? '')
    setTradeName(extCompany.trade_name ?? '')
    setCnpj(extCompany.cnpj ?? '')
    setTaxRegime((extCompany.tax_regime as TaxRegime) ?? '')
    setSegment((extCompany.segment as CompanySegment) ?? '')
  }, [extCompany])

  const formattedCnpj = (raw: string | null | undefined) =>
    raw ? raw.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5') : null

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!canWrite) return
    setSaving(true); setSaved(false); setError(null)
    try {
      await apiFetch(`/api/external-companies/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          name:       name.trim() || undefined,
          trade_name: tradeName.trim() || null,
          cnpj:       cnpj.replace(/\D/g, '') || null,
          tax_regime: taxRegime || null,
          segment:    segment || null,
        }),
      })
      qc.invalidateQueries({ queryKey: ['external-company', id] })
      qc.invalidateQueries({ queryKey: ['external-companies'] })
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch {
      setError(t('settings_errorSave'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col gap-6 max-w-lg">
      <h1 className="text-xl font-semibold text-[var(--text-primary)]">{t('nav_settings')}</h1>

      <Card>
        <h2 className="text-sm font-semibold text-[var(--text-primary)] mb-4">{t('settings_company')}</h2>

        {/* Integrated company — read-only */}
        {!isExternal && intCompany && (
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-2 rounded-lg border border-[var(--bg-border)] bg-[var(--bg-elevated)] px-3 py-2">
              <Lock className="h-3.5 w-3.5 text-[var(--text-muted)] shrink-0" />
              <p className="text-xs text-[var(--text-muted)]">{t('settings_readOnly')}</p>
            </div>
            <ReadOnlyRow label={t('settings_name')} value={intCompany.name} />
            <ReadOnlyRow label={t('settings_cnpj')} value={formattedCnpj(intCompany.cnpj)} />
            <ReadOnlyRow label={t('settings_taxRegime')} value={intCompany.tax_regime ? taxRegimeLabel[intCompany.tax_regime] : null} />
          </div>
        )}

        {/* External company — editable */}
        {isExternal && (
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
              options={taxRegimeOptions}
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

            {error  && <p className="text-xs text-[var(--danger)]">{error}</p>}
            {saved  && <p className="text-xs text-[var(--success)]">{t('settings_saved')}</p>}

            <div className="flex justify-end pt-1">
              <Button type="submit" size="sm" loading={saving}>
                {t('settings_save')}
              </Button>
            </div>
          </form>
        )}
      </Card>
    </div>
  )
}
