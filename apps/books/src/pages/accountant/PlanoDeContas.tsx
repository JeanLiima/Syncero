import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus, Pencil, ChevronRight, ChevronDown } from 'lucide-react'
import { apiFetch } from '@/lib/api'
import { useCompanyContext } from '@/hooks/useCompanyContext'
import { Button, Card } from '@syncero/ui'
import { AccountPlanModal } from '@/components/accountant/AccountPlanModal'
import type { AccountPlan } from '@/types'

function buildTree(plans: AccountPlan[]): AccountPlan[] {
  return plans.slice().sort((a, b) => a.code.localeCompare(b.code))
}

function getDepth(code: string): number {
  return code.split('.').length - 1
}

const accountTypeLabel: Record<string, string> = {
  ativo: 'Ativo',
  passivo: 'Passivo',
  patrimonio_liquido: 'PL',
  receita: 'Receita',
  despesa: 'Despesa',
  custo: 'Custo',
}

export function Component() {
  const { id, isExternal, canWrite } = useCompanyContext()
  const qc = useQueryClient()

  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<AccountPlan | null>(null)
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())

  const queryKey = ['account-plans', id]
  const companyParam = isExternal ? `extCompanyId=${id}` : `companyId=${id}`

  const { data: plans = [], isLoading } = useQuery({
    queryKey,
    queryFn: () => apiFetch<AccountPlan[]>(`/api/account-plans?${companyParam}`),
    enabled: !!id,
  })

  const tree = buildTree(plans)
  const syntheticParents = plans.filter(p => !p.is_analytic)

  const handleSubmit = async (data: {
    code: string; name: string; account_type: string; nature: string; is_analytic: boolean; parent_id: string | null
  }) => {
    const payload = {
      ...data,
      ...(isExternal ? { extCompanyId: id } : { companyId: id }),
    }
    if (editing) {
      await apiFetch(`/api/account-plans/${editing.id}`, { method: 'PATCH', body: JSON.stringify(payload) })
    } else {
      await apiFetch('/api/account-plans', { method: 'POST', body: JSON.stringify(payload) })
    }
    qc.invalidateQueries({ queryKey })
    setEditing(null)
  }

  const toggleCollapse = (id: string) => {
    setCollapsed(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const isVisible = (plan: AccountPlan): boolean => {
    if (!plan.parent_id) return true
    if (collapsed.has(plan.parent_id)) return false
    const parent = plans.find(p => p.id === plan.parent_id)
    if (!parent) return true
    return isVisible(parent)
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-[var(--text-primary)]">Plano de Contas</h1>
          <p className="text-sm text-[var(--text-muted)]">{plans.length} conta{plans.length !== 1 ? 's' : ''}</p>
        </div>
        {canWrite && (
          <Button size="sm" onClick={() => { setEditing(null); setModalOpen(true) }}>
            <Plus className="h-4 w-4" />
            Nova conta
          </Button>
        )}
      </div>

      {isLoading ? (
        <p className="text-sm text-[var(--text-muted)]">Carregando…</p>
      ) : plans.length === 0 ? (
        <Card>
          <div className="flex flex-col items-center gap-3 py-8 text-center">
            <p className="text-sm text-[var(--text-muted)]">Nenhuma conta cadastrada.</p>
            {canWrite && (
              <Button size="sm" variant="ghost" onClick={() => setModalOpen(true)}>Criar primeira conta</Button>
            )}
          </div>
        </Card>
      ) : (
        <Card className="p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--bg-border)] text-left">
                  <th className="px-4 py-3 text-xs font-medium text-[var(--text-muted)] w-32">Código</th>
                  <th className="px-4 py-3 text-xs font-medium text-[var(--text-muted)]">Nome</th>
                  <th className="px-4 py-3 text-xs font-medium text-[var(--text-muted)] w-28">Tipo</th>
                  <th className="px-4 py-3 text-xs font-medium text-[var(--text-muted)] w-24">Natureza</th>
                  <th className="px-4 py-3 text-xs font-medium text-[var(--text-muted)] w-20">Classe</th>
                  {canWrite && <th className="px-4 py-3 w-10" />}
                </tr>
              </thead>
              <tbody>
                {tree.filter(isVisible).map((plan) => {
                  const depth = getDepth(plan.code)
                  const hasChildren = plans.some(p => p.parent_id === plan.id)
                  return (
                    <tr
                      key={plan.id}
                      className="border-b border-[var(--bg-border)]/50 hover:bg-[var(--bg-elevated)] transition-colors"
                    >
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-1" style={{ paddingLeft: `${depth * 12}px` }}>
                          {hasChildren ? (
                            <button
                              onClick={() => toggleCollapse(plan.id)}
                              className="cursor-pointer h-4 w-4 text-[var(--text-muted)] flex-shrink-0"
                            >
                              {collapsed.has(plan.id)
                                ? <ChevronRight className="h-3.5 w-3.5" />
                                : <ChevronDown className="h-3.5 w-3.5" />}
                            </button>
                          ) : (
                            <span className="h-4 w-4 flex-shrink-0" />
                          )}
                          <span className="font-mono text-xs text-[var(--text-secondary)]">{plan.code}</span>
                        </div>
                      </td>
                      <td className="px-4 py-2.5 text-[var(--text-primary)] font-medium">{plan.name}</td>
                      <td className="px-4 py-2.5 text-xs text-[var(--text-secondary)]">{accountTypeLabel[plan.account_type] ?? plan.account_type}</td>
                      <td className="px-4 py-2.5">
                        <span className={`text-xs ${plan.nature === 'devedora' ? 'text-blue-400' : 'text-green-400'}`}>
                          {plan.nature === 'devedora' ? 'Devedora' : 'Credora'}
                        </span>
                      </td>
                      <td className="px-4 py-2.5">
                        <span className={`text-xs px-1.5 py-0.5 rounded ${
                          plan.is_analytic
                            ? 'bg-[var(--accent)]/15 text-[var(--accent)]'
                            : 'bg-[var(--bg-elevated)] text-[var(--text-muted)]'
                        }`}>
                          {plan.is_analytic ? 'Analítica' : 'Sintética'}
                        </span>
                      </td>
                      {canWrite && (
                        <td className="px-4 py-2.5">
                          <button
                            onClick={() => { setEditing(plan); setModalOpen(true) }}
                            className="cursor-pointer p-1.5 rounded hover:bg-[var(--bg-border)] text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                        </td>
                      )}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {canWrite && (
        <AccountPlanModal
          open={modalOpen}
          onClose={() => { setModalOpen(false); setEditing(null) }}
          onSubmit={handleSubmit}
          parents={syntheticParents}
          editing={editing}
        />
      )}
    </div>
  )
}
