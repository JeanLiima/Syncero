import { useParams, Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { FileText, BookOpen, Calculator, LayoutList, BookMarked, Key, ArrowRight } from 'lucide-react'
import { apiFetch } from '@/lib/api'
import { Card } from '@syncero/ui'
import { useT } from '@/i18n'

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

  const items = [
    { label: t('overview_nfe'),             value: summary?.nfeCount ?? 0,                                                                    icon: <FileText   className="h-6 w-6 text-[var(--accent)]"   />, to: 'nfe'         },
    { label: t('overview_sped'),            value: summary?.booksCount ?? 0,                                                                  icon: <BookOpen   className="h-6 w-6 text-[var(--warning)]" />, to: 'sped'        },
    { label: t('overview_taxes'),           value: (summary?.taxTotal ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }), icon: <Calculator className="h-6 w-6 text-[var(--success)]" />, to: 'taxes'       },
    { label: t('overview_chartOfAccounts'), value: t('overview_viewAccounts'),                                                                icon: <BookMarked className="h-6 w-6 text-violet-400"        />, to: 'plano'       },
    { label: t('overview_journal'),         value: t('overview_viewEntries'),                                                                 icon: <LayoutList className="h-6 w-6 text-sky-400"           />, to: 'lancamentos' },
    { label: t('overview_apiKeys'),         value: t('overview_manage'),                                                                      icon: <Key        className="h-6 w-6 text-[var(--success)]" />, to: 'api-keys'    },
  ]

  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="text-xs text-[var(--text-muted)] mb-1">{t('overview_company')}</p>
        <h1 className="text-xl font-semibold text-[var(--text-primary)]">{company?.name ?? '…'}</h1>
        {company?.cnpj && <p className="text-sm text-[var(--text-muted)]">{company.cnpj}</p>}
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
              <p className="text-xl font-semibold font-mono text-[var(--text-primary)]">{item.value}</p>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  )
}
