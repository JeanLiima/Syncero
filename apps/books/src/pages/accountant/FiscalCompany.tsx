import { useParams, Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { FileText, BookOpen, Calculator, LayoutList, BookMarked, ArrowDownUp, ArrowRight } from 'lucide-react'
import { apiFetch } from '@/lib/api'
import { Card } from '@syncero/ui'
import { CompanyTypeBadge } from '@/components/accountant/CompanyTypeBadge'
import { useT } from '@/i18n'

const taxRegimeLabel: Record<string, string> = {
  simples: 'Simples Nacional',
  lucro_presumido: 'Lucro Presumido',
  lucro_real: 'Lucro Real',
}

export function Component() {
  const t = useT()
  const { companyId } = useParams<{ companyId: string }>()

  const { data: company } = useQuery({
    queryKey: ['company-readonly', companyId],
    queryFn: () => apiFetch<{ id: string; name: string; cnpj: string | null; tax_regime: string | null }>(`/api/companies/${companyId}`),
    enabled: !!companyId,
  })

  const { data: summary } = useQuery({
    queryKey: ['fiscal-summary', companyId],
    queryFn: () => apiFetch<{ nfeCount: number; booksCount: number; taxTotal: number }>(`/api/companies/${companyId}/fiscal-summary`),
    enabled: !!companyId,
  })

  const formattedCnpj = company?.cnpj
    ? company.cnpj.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5')
    : null

  const items = [
    { label: t('overview_nfe'),             value: String(summary?.nfeCount ?? 0),                                                           icon: <FileText    className="h-6 w-6 text-[var(--accent)]"   />, to: 'nfe'               },
    { label: t('overview_sped'),            value: String(summary?.booksCount ?? 0),                                                         icon: <BookOpen    className="h-6 w-6 text-[var(--warning)]" />, to: 'sped'              },
    { label: t('overview_taxes'),           value: (summary?.taxTotal ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }), icon: <Calculator  className="h-6 w-6 text-[var(--success)]" />, to: 'taxes'             },
    { label: t('overview_transactions'),    value: t('overview_viewTransactions'), icon: <ArrowDownUp className="h-6 w-6 text-sky-400"           />, to: 'transactions'      },
    { label: t('overview_chartOfAccounts'), value: t('overview_viewAccounts'),    icon: <BookMarked  className="h-6 w-6 text-violet-400"        />, to: 'chart-of-accounts' },
    { label: t('overview_journal'),         value: t('overview_viewEntries'),     icon: <LayoutList  className="h-6 w-6 text-[var(--warning)]" />, to: 'journal-entries'   },
  ]

  return (
    <div className="flex flex-col gap-6">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <p className="text-xs text-[var(--text-muted)]">{t('overview_company')}</p>
          <CompanyTypeBadge isExternal={false} />
        </div>
        <h1 className="text-xl font-semibold text-[var(--text-primary)]">{company?.name ?? '…'}</h1>
        {formattedCnpj && <p className="text-sm text-[var(--text-muted)] font-mono">{formattedCnpj}</p>}
        {company?.tax_regime && (
          <p className="text-xs text-[var(--text-muted)] mt-0.5">{taxRegimeLabel[company.tax_regime] ?? company.tax_regime}</p>
        )}
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
