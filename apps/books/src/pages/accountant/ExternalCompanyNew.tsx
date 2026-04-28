import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { ArrowLeft } from 'lucide-react'
import { apiFetch } from '@/lib/api'
import { useAuth } from '@/hooks/useAuth'
import { Button, Input, Select, Card, Checkbox } from '@syncero/ui'
import { useT } from '@/i18n'
import type { TaxRegime, CompanyIntegration, CompanySegment } from '@/types'

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

const taxRegimeOptions = [
  { value: '', label: '— Não definido —' },
  { value: 'simples', label: 'Simples Nacional' },
  { value: 'lucro_presumido', label: 'Lucro Presumido' },
  { value: 'lucro_real', label: 'Lucro Real' },
]

const integrationOptions = [
  { value: 'manual', label: 'Manual' },
  { value: 'other', label: 'Outro sistema' },
]

export function Component() {
  const t = useT()
  const { user } = useAuth()
  const navigate = useNavigate()
  const qc = useQueryClient()

  const [name, setName] = useState('')
  const [cnpj, setCnpj] = useState('')
  const [tradeName, setTradeName] = useState('')
  const [taxRegime, setTaxRegime] = useState<TaxRegime | ''>('')
  const [integration, setIntegration] = useState<CompanyIntegration>('manual')
  const [segment, setSegment] = useState<CompanySegment | ''>('')
  const [notes, setNotes] = useState('')
  const [seedPlan, setSeedPlan] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (!name.trim()) { setError(t('external_errorName')); return }
    if (!user?.id) return

    setSubmitting(true)
    try {
      const rawCnpj = cnpj.replace(/\D/g, '')
      const company = await apiFetch<{ id: string }>('/api/external-companies', {
        method: 'POST',
        body: JSON.stringify({
          name: name.trim(),
          cnpj: rawCnpj || null,
          trade_name: tradeName.trim() || null,
          tax_regime: taxRegime || null,
          integration,
          segment: segment || null,
          notes: notes.trim() || null,
          seedPlan,
        }),
      })

      qc.invalidateQueries({ queryKey: ['external-companies', user.id] })
      navigate(`/accountant/external/${company.id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : t('external_errorCreate'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex flex-col gap-6 max-w-lg">
      <div>
        <button
          onClick={() => navigate('/accountant')}
          className="cursor-pointer flex items-center gap-1.5 text-sm text-[var(--text-muted)] hover:text-[var(--text-secondary)] mb-3 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          {t('external_back')}
        </button>
        <h1 className="text-xl font-semibold text-[var(--text-primary)]">{t('external_title')}</h1>
        <p className="text-sm text-[var(--text-muted)]">{t('external_subtitle')}</p>
      </div>

      <Card>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <Input
            label={t('external_name')}
            placeholder={t('external_namePlaceholder')}
            value={name}
            onChange={e => setName(e.target.value)}
          />
          <Input
            label={t('external_tradeName')}
            placeholder={t('external_tradeNamePlaceholder')}
            value={tradeName}
            onChange={e => setTradeName(e.target.value)}
          />
          <Input
            label={t('external_cnpj')}
            placeholder={t('external_cnpjPlaceholder')}
            value={cnpj}
            onChange={e => setCnpj(e.target.value)}
            maxLength={18}
          />
          <Select
            label={t('external_taxRegime')}
            options={taxRegimeOptions}
            value={taxRegime}
            onChange={v => setTaxRegime(v as TaxRegime | '')}
          />
          <Select
            label={t('external_segment')}
            options={segmentOptions}
            value={segment}
            onChange={v => setSegment(v as CompanySegment | '')}
          />
          <Select
            label={t('external_integration')}
            options={integrationOptions}
            value={integration}
            onChange={v => setIntegration(v as CompanyIntegration)}
          />
          <Input
            label={t('external_notes')}
            placeholder={t('external_notesPlaceholder')}
            value={notes}
            onChange={e => setNotes(e.target.value)}
          />

          <Checkbox
            label={t('external_seedPlan')}
            checked={seedPlan}
            onChange={e => setSeedPlan((e.target as HTMLInputElement).checked)}
          />

          {error && <p className="text-xs text-[var(--danger)]">{error}</p>}

          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="ghost" onClick={() => navigate('/accountant')}>{t('external_cancel')}</Button>
            <Button type="submit" loading={submitting}>{t('external_create')}</Button>
          </div>
        </form>
      </Card>
    </div>
  )
}
