import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus, Pencil, ChevronRight, ChevronDown, Search, X } from 'lucide-react'
import { apiFetch } from '@/lib/api'
import { useCompanyContext } from '@/hooks/useCompanyContext'
import { Button, Card, Input, Select } from '@syncero/ui'
import { AccountPlanModal } from '@/components/accountant/AccountPlanModal'
import { useT } from '@/i18n'
import type { AccountPlan } from '@/types'

function buildTree(plans: AccountPlan[]): AccountPlan[] {
  return plans.slice().sort((a, b) => a.code.localeCompare(b.code))
}

function getDepth(code: string): number {
  return code.split('.').length - 1
}

export function Component() {
  const t = useT()
  const accountTypeLabel: Record<string, string> = {
    ativo: t('plano_ativo'),
    passivo: t('plano_passivo'),
    patrimonio_liquido: t('plano_patrimonioLiquido'),
    receita: t('plano_receita'),
    despesa: t('plano_despesa'),
    custo: t('plano_custo'),
  }
  const { id, isExternal, canWrite } = useCompanyContext()
  const qc = useQueryClient()

  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<AccountPlan | null>(null)
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())

  const [search, setSearch] = useState('')
  const [filterType, setFilterType] = useState('')
  const [filterClass, setFilterClass] = useState('')
  const hasFilter = !!(search || filterType || filterClass)

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

  const visiblePlans = hasFilter
    ? tree.filter(plan => {
        const q = search.toLowerCase()
        const matchesSearch = !search ||
          plan.name.toLowerCase().includes(q) ||
          plan.code.toLowerCase().includes(q)
        const matchesType  = !filterType  || plan.account_type === filterType
        const matchesClass = !filterClass || String(plan.is_analytic) === filterClass
        return matchesSearch && matchesType && matchesClass
      })
    : tree.filter(isVisible)

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-[var(--text-primary)]">{t('plano_title')}</h1>
          <p className="text-sm text-[var(--text-muted)]">{plans.length} {plans.length !== 1 ? t('plano_countPlural') : t('plano_countSingular')}</p>
        </div>
        {canWrite && (
          <Button size="sm" onClick={() => { setEditing(null); setModalOpen(true) }}>
            <Plus className="h-4 w-4" />
            {t('plano_new')}
          </Button>
        )}
      </div>

      {/* Filter bar */}
      {plans.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-40">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[var(--text-muted)]" />
            <Input
              size="sm"
              placeholder={t('plano_searchPlaceholder')}
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-8"
            />
          </div>
          <Select
            size="sm"
            placeholder="Tipo"
            value={filterType}
            onChange={setFilterType}
            className="w-36"
            options={[
              { value: '',                  label: t('plano_filterAllTypes') },
              { value: 'ativo',             label: t('plano_ativo')          },
              { value: 'passivo',           label: t('plano_passivo')        },
              { value: 'patrimonio_liquido',label: t('plano_patrimonioLiquido') },
              { value: 'receita',           label: t('plano_receita')        },
              { value: 'despesa',           label: t('plano_despesa')        },
              { value: 'custo',             label: t('plano_custo')          },
            ]}
          />
          <Select
            size="sm"
            placeholder="Classe"
            value={filterClass}
            onChange={setFilterClass}
            className="w-32"
            options={[
              { value: '',      label: t('plano_filterAllClasses') },
              { value: 'true',  label: t('plano_filterAnalytic')   },
              { value: 'false', label: t('plano_filterSynthetic')  },
            ]}
          />
          {hasFilter && (
            <button
              onClick={() => { setSearch(''); setFilterType(''); setFilterClass('') }}
              className="cursor-pointer flex items-center gap-1 text-xs text-[var(--text-muted)] hover:text-[var(--danger)] transition-colors"
            >
              <X className="h-3.5 w-3.5" />
              {t('plano_clearFilters')}
            </button>
          )}
        </div>
      )}

      {isLoading ? (
        <p className="text-sm text-[var(--text-muted)]">{t('plano_loading')}</p>
      ) : plans.length === 0 ? (
        <Card>
          <div className="flex flex-col items-center gap-3 py-8 text-center">
            <p className="text-sm text-[var(--text-muted)]">{t('plano_empty')}</p>
            {canWrite && (
              <Button size="sm" variant="ghost" onClick={() => setModalOpen(true)}>{t('plano_createFirst')}</Button>
            )}
          </div>
        </Card>
      ) : (
        <Card className="p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--bg-border)] text-left">
                  <th className="px-4 py-3 text-xs font-medium text-[var(--text-muted)] w-32">{t('plano_colCode')}</th>
                  <th className="px-4 py-3 text-xs font-medium text-[var(--text-muted)]">{t('plano_colName')}</th>
                  <th className="px-4 py-3 text-xs font-medium text-[var(--text-muted)] w-28">{t('plano_colType')}</th>
                  <th className="px-4 py-3 text-xs font-medium text-[var(--text-muted)] w-24">{t('plano_colNature')}</th>
                  <th className="px-4 py-3 text-xs font-medium text-[var(--text-muted)] w-20">{t('plano_colClass')}</th>
                  {canWrite && <th className="px-4 py-3 w-10" />}
                </tr>
              </thead>
              <tbody>
                {visiblePlans.length === 0 ? (
                  <tr>
                    <td colSpan={canWrite ? 6 : 5} className="px-4 py-8 text-center text-sm text-[var(--text-muted)]">
                      {t('plano_noResults')}
                    </td>
                  </tr>
                ) : null}
              {visiblePlans.map((plan) => {
                  const depth = getDepth(plan.code)
                  const hasChildren = plans.some(p => p.parent_id === plan.id)
                  return (
                    <tr
                      key={plan.id}
                      className="border-b border-[var(--bg-border)]/50 hover:bg-[var(--bg-elevated)] transition-colors"
                    >
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-1" style={{ paddingLeft: `${depth * 12}px` }}>
                          {hasChildren && !hasFilter ? (
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
                          {plan.nature === 'devedora' ? t('plano_debtor') : t('plano_creditor')}
                        </span>
                      </td>
                      <td className="px-4 py-2.5">
                        <span className={`text-xs px-1.5 py-0.5 rounded ${
                          plan.is_analytic
                            ? 'bg-[var(--accent)]/15 text-[var(--accent)]'
                            : 'bg-[var(--bg-elevated)] text-[var(--text-muted)]'
                        }`}>
                          {plan.is_analytic ? t('plano_analytic') : t('plano_synthetic')}
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
