import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { Building2, ArrowRight } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { Card, Badge } from '@/components/ui'
import type { AccountantCompany } from '@/types'

export function Component() {
  const { user } = useAuth()

  const { data: companies = [], isLoading } = useQuery({
    queryKey: ['accountant-companies', user?.id],
    queryFn: async () => {
      if (!user?.id) return []
      const { data, error } = await supabase
        .from('accountant_companies')
        .select('*, companies(id, name, cnpj, tax_regime)')
        .eq('accountant_id', user.id)
        .eq('status', 'accepted')
        .order('accepted_at', { ascending: false })
      if (error) throw error
      return (data ?? []) as AccountantCompany[]
    },
    enabled: !!user?.id,
  })

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-[var(--text-primary)]">Minhas Empresas</h1>
        <p className="text-sm text-[var(--text-muted)]">{companies.length} empresa{companies.length !== 1 ? 's' : ''} vinculada{companies.length !== 1 ? 's' : ''}</p>
      </div>

      {isLoading ? (
        <p className="text-sm text-[var(--text-muted)]">Carregando…</p>
      ) : companies.length === 0 ? (
        <Card>
          <div className="flex flex-col items-center gap-3 py-8">
            <Building2 className="h-10 w-10 text-[var(--text-muted)]" />
            <p className="text-sm text-[var(--text-muted)]">Nenhuma empresa vinculada ainda.</p>
            <p className="text-xs text-[var(--text-muted)]">Aguarde um convite de alguma empresa.</p>
          </div>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {companies.map((ac) => {
            const company = ac.companies as unknown as { id: string; name: string; cnpj: string | null; tax_regime: string | null } | null
            if (!company) return null
            return (
              <Link key={ac.id} to={`/accountant/company/${company.id}`}>
                <Card className="hover:border-[var(--accent)] transition-colors cursor-pointer group">
                  <div className="flex items-start justify-between mb-3">
                    <div className="h-10 w-10 rounded-lg bg-[var(--accent-subtle)] flex items-center justify-center">
                      <Building2 className="h-5 w-5 text-[var(--accent)]" />
                    </div>
                    <ArrowRight className="h-4 w-4 text-[var(--text-muted)] group-hover:text-[var(--accent)] transition-colors" />
                  </div>
                  <h3 className="font-semibold text-[var(--text-primary)] mb-1">{company.name}</h3>
                  {company.cnpj && (
                    <p className="text-xs text-[var(--text-muted)] mb-2">{company.cnpj}</p>
                  )}
                  {company.tax_regime && (
                    <Badge variant="info" className="text-xs">
                      {company.tax_regime.replace('_', ' ')}
                    </Badge>
                  )}
                </Card>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
