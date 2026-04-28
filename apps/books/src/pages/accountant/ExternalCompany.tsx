import { useParams, Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { LayoutList, BookMarked, Key, ArrowRight } from 'lucide-react'
import { apiFetch } from '@/lib/api'
import { Card } from '@syncero/ui'
import { CompanyTypeBadge } from '@/components/accountant/CompanyTypeBadge'
import { useT } from '@/i18n'
import type { ExternalCompany } from '@/types'

const taxRegimeLabel: Record<string, string> = {
  simples: 'Simples Nacional',
  lucro_presumido: 'Lucro Presumido',
  lucro_real: 'Lucro Real',
}

const segmentLabel: Record<string, string> = {
  comercio: 'Comércio',
  servicos: 'Serviços',
  industria: 'Indústria',
  construcao_civil: 'Construção Civil',
  agronegocio: 'Agronegócio',
  saude: 'Saúde',
  educacao: 'Educação',
  tecnologia: 'Tecnologia',
  financeiro: 'Financeiro',
  outros: 'Outros',
}

export function Component() {
  const t = useT()
  const { extCompanyId } = useParams<{ extCompanyId: string }>()

  const { data: company } = useQuery({
    queryKey: ['external-company', extCompanyId],
    queryFn: () => apiFetch<ExternalCompany>(`/api/external-companies/${extCompanyId}`),
    enabled: !!extCompanyId,
  })

  const { data: planCount = 0 } = useQuery({
    queryKey: ['account-plan-count', extCompanyId],
    queryFn: () => apiFetch<unknown[]>(`/api/account-plans?extCompanyId=${extCompanyId}`).then(d => d.length),
    enabled: !!extCompanyId,
  })

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
      label: t('overview_chartOfAccounts'),
      value: `${planCount} ${planCount !== 1 ? t('overview_accountCountPlural') : t('overview_accountCount')}`,
      icon: <BookMarked className="h-6 w-6 text-[var(--accent)]" />,
      to: 'plano',
    },
    {
      label: t('overview_journal'),
      value: `${entryCount} ${entryCount !== 1 ? t('overview_entryCountPlural') : t('overview_entryCount')}`,
      icon: <LayoutList className="h-6 w-6 text-[var(--warning)]" />,
      to: 'lancamentos',
    },
    {
      label: t('overview_apiKeys'),
      value: t('overview_manage'),
      icon: <Key className="h-6 w-6 text-[var(--success)]" />,
      to: 'api-keys',
    },
  ]

  return (
    <div className="flex flex-col gap-6">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <p className="text-xs text-[var(--text-muted)]">{t('overview_externalCompany')}</p>
          {company && (
            <CompanyTypeBadge isExternal />
          )}
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
