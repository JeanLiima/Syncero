import { useParams, Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { LayoutList, ArrowRight, Receipt } from 'lucide-react'
import { apiFetch } from '@/lib/api'
import { getTransactions } from '@/lib/backend'
import { Card } from '@syncero/ui'
import { CompanyTypeBadge } from '@/components/accountant/CompanyTypeBadge'
import { useT } from '@/i18n'
import type { ExternalCompany, TaxRegime } from '@/types'

export function Component() {
  const t = useT()

  const taxRegimeLabel: Record<TaxRegime, string> = {
    simples:          t('settings_simplesNacional'),
    lucro_presumido:  t('settings_lucroPresumido'),
    lucro_real:       t('settings_lucroReal'),
  }

  const segmentLabel: Record<string, string> = {
    retail:        t('settings_segmentComercio'),
    services:      t('settings_segmentServicos'),
    manufacturing: t('settings_segmentIndustria'),
    construction:  t('settings_segmentConstrucao'),
    agribusiness:  t('settings_segmentAgronegocio'),
    healthcare:    t('settings_segmentSaude'),
    education:     t('settings_segmentEducacao'),
    technology:    t('settings_segmentTecnologia'),
    financial:     t('settings_segmentFinanceiro'),
    other:         t('settings_segmentOutros'),
  }

  const { extCompanyId } = useParams<{ extCompanyId: string }>()

  const { data: company } = useQuery({
    queryKey: ['external-company', extCompanyId],
    queryFn: () => apiFetch<ExternalCompany>(`/api/external-companies/${extCompanyId}`),
    enabled: !!extCompanyId,
  })

  const { data: txData } = useQuery({
    queryKey: ['ext-transactions-count', extCompanyId],
    queryFn: () => getTransactions({ extCompanyId: extCompanyId!, pageSize: '1' }),
    enabled: !!extCompanyId,
  })
  const txCount = txData?.count ?? 0

  const { data: entryCount = 0 } = useQuery({
    queryKey: ['journal-entry-count', extCompanyId],
    queryFn: () => apiFetch<unknown[]>(`/api/journal-entries?extCompanyId=${extCompanyId}`).then(d => d.length),
    enabled: !!extCompanyId,
  })

  const formattedCnpj = company?.cnpj
    ? company.cnpj.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5')
    : null

  const items = [
    {
      label: t('overview_transactions'),
      value: `${txCount} ${txCount !== 1 ? t('overview_txCountPlural') : t('overview_txCount')}`,
      icon: <Receipt className="h-6 w-6 text-[var(--success)]" />,
      to: 'transactions',
    },
    {
      label: t('overview_journal'),
      value: `${entryCount} ${entryCount !== 1 ? t('overview_entryCountPlural') : t('overview_entryCount')}`,
      icon: <LayoutList className="h-6 w-6 text-[var(--warning)]" />,
      to: 'journal-entries',
    },
  ]

  return (
    <div className="flex flex-col gap-6">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <p className="text-xs text-[var(--text-muted)]">{t('overview_externalCompany')}</p>
          {company && <CompanyTypeBadge isExternal />}
        </div>
        <h1 className="text-xl font-semibold text-[var(--text-primary)]">{company?.name ?? '…'}</h1>
        {formattedCnpj && <p className="text-sm text-[var(--text-muted)] font-mono">{formattedCnpj}</p>}
        <div className="flex flex-wrap items-center gap-2 mt-1">
          {company?.tax_regime && (
            <span className="text-xs text-[var(--text-muted)]">{taxRegimeLabel[company.tax_regime] ?? company.tax_regime}</span>
          )}
          {company?.tax_regime && company?.segment && (
            <span className="text-xs text-[var(--text-muted)]">·</span>
          )}
          {company?.segment && (
            <span className="text-xs text-[var(--text-muted)]">{segmentLabel[company.segment] ?? company.segment}</span>
          )}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {items.map((item) => (
          <Link key={item.to} to={item.to}>
            <Card className="hover:border-[var(--accent)] transition-colors cursor-pointer group">
              <div className="flex items-start justify-between mb-3">
                <div className="h-10 w-10 rounded-lg bg-[var(--bg-elevated)] flex items-center justify-center">
                  {item.icon}
                </div>
                <ArrowRight className="h-4 w-4 text-[var(--text-muted)] group-hover:text-[var(--accent)] transition-colors" />
              </div>
              <p className="text-xs text-[var(--text-muted)] mb-1">{item.label}</p>
              <p className="text-lg font-semibold text-[var(--text-primary)]">{item.value}</p>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  )
}
