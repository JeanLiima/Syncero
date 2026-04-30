import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { apiFetch } from '@/lib/api'
import { useAuth } from '@/hooks/useAuth'
import { Button, Input, Select, Modal, Checkbox } from '@syncero/ui'
import { useT } from '@/i18n'
import type { TaxRegime, CompanySegment } from '@/types'


interface Props {
  open: boolean
  onClose: () => void
}

export function CreateExternalCompanyModal({ open, onClose }: Props) {
  const t = useT()
  const segmentOptions = [
    { value: '',                label: t('settings_segmentUndefined') },
    { value: 'comercio',        label: t('settings_segmentComercio') },
    { value: 'servicos',        label: t('settings_segmentServicos') },
    { value: 'industria',       label: t('settings_segmentIndustria') },
    { value: 'construcao_civil',label: t('settings_segmentConstrucao') },
    { value: 'agronegocio',     label: t('settings_segmentAgronegocio') },
    { value: 'saude',           label: t('settings_segmentSaude') },
    { value: 'educacao',        label: t('settings_segmentEducacao') },
    { value: 'tecnologia',      label: t('settings_segmentTecnologia') },
    { value: 'financeiro',      label: t('settings_segmentFinanceiro') },
    { value: 'outros',          label: t('settings_segmentOutros') },
  ]
  const taxRegimeOptions = [
    { value: '',                label: t('settings_taxRegimeUndefined') },
    { value: 'simples',         label: t('settings_simplesNacional') },
    { value: 'lucro_presumido', label: t('settings_lucroPresumido') },
    { value: 'lucro_real',      label: t('settings_lucroReal') },
  ]
  const { user } = useAuth()
  const navigate = useNavigate()
  const qc = useQueryClient()

  const [name,      setName]      = useState('')
  const [tradeName, setTradeName] = useState('')
  const [cnpj,      setCnpj]      = useState('')
  const [taxRegime, setTaxRegime] = useState<TaxRegime | ''>('')
  const [segment,   setSegment]   = useState<CompanySegment | ''>('')
  const [seedPlan,  setSeedPlan]  = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error,      setError]      = useState<string | null>(null)

  const reset = () => {
    setName(''); setTradeName(''); setCnpj('')
    setTaxRegime(''); setSegment('')
    setSeedPlan(true); setError(null)
  }

  const handleClose = () => { reset(); onClose() }

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
          integration: 'manual',
          segment: segment || null,
          seedPlan,
        }),
      })
      qc.invalidateQueries({ queryKey: ['external-companies', user.id] })
      onClose()
      navigate(`/accountant/external/${company.id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : t('external_errorCreate'))
      setSubmitting(false)
    }
  }

  const footer = (
    <div className="flex items-center justify-between">
      <Button type="button" variant="ghost" size="sm" onClick={handleClose} disabled={submitting}>
        {t('external_cancel')}
      </Button>
      <Button size="sm" loading={submitting} onClick={handleSubmit as unknown as React.MouseEventHandler}>
        {t('external_create')}
      </Button>
    </div>
  )

  return (
    <Modal open={open} onClose={handleClose} title={t('external_title')} size="md" footer={footer}>
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
          searchable
        />
        <Checkbox
          label={t('external_seedPlan')}
          checked={seedPlan}
          onChange={e => setSeedPlan((e.target as HTMLInputElement).checked)}
        />
        {error && <p className="text-xs text-[var(--danger)]">{error}</p>}
      </form>
    </Modal>
  )
}
