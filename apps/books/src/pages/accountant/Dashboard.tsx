import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { Plus } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { Button } from '@syncero/ui'
import { CompanyCard } from '@/components/accountant/CompanyCard'
import type { AccountantCompany, ExternalCompany, TaxRegime } from '@/types'

type Filter = 'all' | 'syncero' | 'external'

export function Component() {
  const { user } = useAuth()
  const [filter, setFilter] = useState<Filter>('all')

  const { data: synceroCompanies = [], isLoading: loadingSyncero } = useQuery({
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

  const { data: externalCompanies = [], isLoading: loadingExternal } = useQuery({
    queryKey: ['external-companies', user?.id],
    queryFn: async () => {
      if (!user?.id) return []
      const { data, error } = await supabase
        .from('external_companies')
        .select('*')
        .eq('accountant_id', user.id)
        .eq('is_active', true)
        .order('created_at', { ascending: false })
      if (error) throw error
      return (data ?? []) as ExternalCompany[]
    },
    enabled: !!user?.id,
  })

  const isLoading = loadingSyncero || loadingExternal
  const total = synceroCompanies.length + externalCompanies.length

  const filterTabs: { value: Filter; label: string }[] = [
    { value: 'all', label: `Todas (${total})` },
    { value: 'syncero', label: `Syncero Flow (${synceroCompanies.length})` },
    { value: 'external', label: `Externas (${externalCompanies.length})` },
  ]

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-semibold text-[var(--text-primary)]">Minhas Empresas</h1>
          <p className="text-sm text-[var(--text-muted)]">{total} empresa{total !== 1 ? 's' : ''} gerenciada{total !== 1 ? 's' : ''}</p>
        </div>
        <Link to="/accountant/external/new">
          <Button size="sm">
            <Plus className="h-4 w-4" />
            Adicionar empresa
          </Button>
        </Link>
      </div>

      <div className="flex gap-1 border-b border-[var(--bg-border)]">
        {filterTabs.map(tab => (
          <button
            key={tab.value}
            onClick={() => setFilter(tab.value)}
            className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
              filter === tab.value
                ? 'border-[var(--accent)] text-[var(--accent)]'
                : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <p className="text-sm text-[var(--text-muted)]">Carregando…</p>
      ) : total === 0 ? (
        <div className="flex flex-col items-center gap-3 py-12 text-center">
          <p className="text-sm text-[var(--text-muted)]">Nenhuma empresa ainda.</p>
          <p className="text-xs text-[var(--text-muted)]">
            Adicione uma empresa externa ou aguarde um convite de uma empresa Syncero Flow.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {(filter === 'all' || filter === 'syncero') &&
            synceroCompanies.map((ac) => {
              const c = ac.companies as unknown as { id: string; name: string; cnpj: string | null; tax_regime: string | null } | null
              if (!c) return null
              return (
                <CompanyCard
                  key={ac.id}
                  id={c.id}
                  name={c.name}
                  cnpj={c.cnpj}
                  taxRegime={c.tax_regime as TaxRegime | null}
                  isExternal={false}
                />
              )
            })}
          {(filter === 'all' || filter === 'external') &&
            externalCompanies.map((ec) => (
              <CompanyCard
                key={ec.id}
                id={ec.id}
                name={ec.name}
                cnpj={ec.cnpj}
                taxRegime={ec.tax_regime}
                isExternal={true}
                integration={ec.integration}
              />
            ))}
        </div>
      )}
    </div>
  )
}
