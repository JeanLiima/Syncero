import { useParams, Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { FileText, BookOpen, Calculator, ArrowRight } from 'lucide-react'
import { format, startOfMonth, endOfMonth } from 'date-fns'
import { supabase } from '@/lib/supabase'
import { Card } from '@/components/ui'

export function Component() {
  const { companyId } = useParams<{ companyId: string }>()
  const now = new Date()
  const dateFrom = format(startOfMonth(now), 'yyyy-MM-dd')
  const dateTo   = format(endOfMonth(now),   'yyyy-MM-dd')

  const { data: company } = useQuery({
    queryKey: ['company-readonly', companyId],
    queryFn: async () => {
      const { data } = await supabase.from('companies').select('id, name, cnpj, tax_regime').eq('id', companyId!).single()
      return data
    },
    enabled: !!companyId,
  })

  const { data: summary } = useQuery({
    queryKey: ['fiscal-summary', companyId],
    queryFn: async () => {
      const [nfe, books, taxes] = await Promise.all([
        supabase
          .from('fiscal_documents')
          .select('id', { count: 'exact', head: true })
          .eq('company_id', companyId!),
        supabase
          .from('fiscal_books')
          .select('id', { count: 'exact', head: true })
          .eq('company_id', companyId!),
        supabase
          .from('tax_calculations')
          .select('tax_value')
          .eq('company_id', companyId!)
          .gte('reference_period', dateFrom.slice(0, 7))
          .lte('reference_period', dateTo.slice(0, 7)),
      ])
      const taxTotal = taxes.data?.reduce((s, t) => s + t.tax_value, 0) ?? 0
      return { nfeCount: nfe.count ?? 0, booksCount: books.count ?? 0, taxTotal }
    },
    enabled: !!companyId,
  })

  const items = [
    { label: 'NF-e / NFS-e', value: summary?.nfeCount ?? 0, icon: <FileText className="h-6 w-6 text-[var(--accent)]" />, to: 'nfe' },
    { label: 'Livros SPED', value: summary?.booksCount ?? 0, icon: <BookOpen className="h-6 w-6 text-[var(--warning)]" />, to: 'sped' },
    {
      label: 'Impostos do mês',
      value: (summary?.taxTotal ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }),
      icon: <Calculator className="h-6 w-6 text-[var(--success)]" />,
      to: 'taxes',
    },
  ]

  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="text-xs text-[var(--text-muted)] mb-1">Empresa</p>
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
