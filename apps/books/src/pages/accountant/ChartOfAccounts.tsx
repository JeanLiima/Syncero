import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus, Pencil, ChevronRight, ChevronDown, Search, X, BookMarked, Sparkles } from 'lucide-react'
import { apiFetch } from '@/lib/api'
import { seedAccountPlan } from '@/lib/backend'
import { useCompanyContext } from '@/hooks/useCompanyContext'
import { Button, Card, Input, Select, useToast } from '@syncero/ui'
import { AccountPlanModal, type AccountPlanModalProps } from '@/components/accountant/AccountPlanModal'
import { useT } from '@/i18n'
import type { AccountPlan, AccountType } from '@/types'

// ── constants ─────────────────────────────────────────────────

const ACCOUNT_SECTIONS: { type: AccountType; labelKey: string; color: string; subtleColor: string }[] = [
  { type: 'ativo',             labelKey: 'plano_ativo',             color: 'text-blue-400',   subtleColor: 'bg-blue-500/10'   },
  { type: 'passivo',           labelKey: 'plano_passivo',           color: 'text-orange-400', subtleColor: 'bg-orange-500/10' },
  { type: 'patrimonio_liquido',labelKey: 'plano_patrimonioLiquido', color: 'text-violet-400', subtleColor: 'bg-violet-500/10' },
  { type: 'receita',           labelKey: 'plano_receita',           color: 'text-green-400',  subtleColor: 'bg-green-500/10'  },
  { type: 'despesa',           labelKey: 'plano_despesa',           color: 'text-red-400',    subtleColor: 'bg-red-500/10'    },
  { type: 'custo',             labelKey: 'plano_custo',             color: 'text-yellow-400', subtleColor: 'bg-yellow-500/10' },
]

// ── helpers ───────────────────────────────────────────────────

function getDepth(code: string) { return code.split('.').length - 1 }

function isVisible(plan: AccountPlan, plans: AccountPlan[], collapsed: Set<string>): boolean {
  if (!plan.parent_id) return true
  if (collapsed.has(plan.parent_id)) return false
  const parent = plans.find(p => p.id === plan.parent_id)
  return parent ? isVisible(parent, plans, collapsed) : true
}

// ── First-access onboarding ───────────────────────────────────

function FirstAccess({ onSeed, onSkip, seeding }: {
  onSeed: () => void; onSkip: () => void; seeding: boolean
}) {
  const t = useT()
  return (
    <Card>
      <div className="flex flex-col items-center gap-4 py-8 text-center">
        <div className="h-14 w-14 rounded-2xl bg-[var(--bg-elevated)] border border-[var(--bg-border)] flex items-center justify-center">
          <BookMarked className="h-7 w-7 text-[var(--text-muted)]" />
        </div>
        <div>
          <p className="text-sm font-medium text-[var(--text-primary)]">{t('plano_seedTitle')}</p>
          <p className="text-xs text-[var(--text-muted)] mt-1 max-w-xs">{t('plano_seedSubtitle')}</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3 mt-2">
          <Button size="sm" onClick={onSeed} loading={seeding}>
            <Sparkles className="h-3.5 w-3.5" />
            {t('plano_seedCfc')}
          </Button>
          <Button size="sm" variant="ghost" onClick={onSkip} disabled={seeding}>
            {t('plano_seedCustom')}
          </Button>
        </div>
      </div>
    </Card>
  )
}

// ── Section header ────────────────────────────────────────────

function SectionHeader({ label, count, color, subtleColor, collapsed, onToggle, onAdd, canWrite }: {
  label: string; count: number; color: string; subtleColor: string
  collapsed: boolean; onToggle: () => void; onAdd: () => void; canWrite: boolean
}) {
  return (
    <div className={`flex items-center justify-between px-4 py-2.5 rounded-t-[var(--radius-lg)] border border-[var(--bg-border)] ${subtleColor}`}>
      <button
        onClick={onToggle}
        className="flex items-center gap-2 cursor-pointer group"
      >
        {collapsed
          ? <ChevronRight className={`h-3.5 w-3.5 ${color}`} />
          : <ChevronDown  className={`h-3.5 w-3.5 ${color}`} />
        }
        <span className={`text-xs font-semibold uppercase tracking-wider ${color}`}>{label}</span>
        <span className="text-xs text-[var(--text-muted)]">({count})</span>
      </button>
      {canWrite && !collapsed && (
        <button
          onClick={onAdd}
          className="flex items-center gap-1 text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors cursor-pointer"
        >
          <Plus className="h-3 w-3" />
          Nova conta
        </button>
      )}
    </div>
  )
}

// ── Account row ───────────────────────────────────────────────

function AccountRow({ plan, plans, collapsed, onToggle, onEdit, onAddChild, canWrite, hasFilter }: {
  plan: AccountPlan; plans: AccountPlan[]; collapsed: Set<string>
  onToggle: (id: string) => void; onEdit: (p: AccountPlan) => void
  onAddChild: (p: AccountPlan) => void; canWrite: boolean; hasFilter: boolean
}) {
  const t = useT()
  const depth      = getDepth(plan.code)
  const hasChildren = plans.some(p => p.parent_id === plan.id)
  const isCollapsed = collapsed.has(plan.id)

  return (
    <tr className="border-b border-[var(--bg-border)]/50 hover:bg-[var(--bg-elevated)] transition-colors group">
      <td className="px-4 py-2">
        <div className="flex items-center gap-1" style={{ paddingLeft: `${depth * 14}px` }}>
          {hasChildren && !hasFilter ? (
            <button
              onClick={() => onToggle(plan.id)}
              className="cursor-pointer h-4 w-4 text-[var(--text-muted)] flex-shrink-0 hover:text-[var(--text-primary)]"
            >
              {isCollapsed ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
            </button>
          ) : (
            <span className="h-4 w-4 flex-shrink-0" />
          )}
          <span className="font-mono text-xs text-[var(--text-secondary)]">{plan.code}</span>
        </div>
      </td>
      <td className="px-4 py-2">
        <span className={plan.is_analytic ? 'text-[var(--text-primary)] text-sm' : 'text-[var(--text-secondary)] text-sm font-medium'}>
          {plan.name}
        </span>
      </td>
      <td className="px-4 py-2">
        <span className={`text-xs px-1.5 py-0.5 rounded ${
          plan.is_analytic
            ? 'bg-[var(--accent)]/15 text-[var(--accent)]'
            : 'bg-[var(--bg-elevated)] text-[var(--text-muted)]'
        }`}>
          {plan.is_analytic ? t('plano_analytic') : t('plano_synthetic')}
        </span>
      </td>
      {canWrite && (
        <td className="px-2 py-2 w-16">
          <div className="flex items-center justify-end gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
            <div className="relative group/tip">
              <button
                onClick={() => onAddChild(plan)}
                className="cursor-pointer p-1.5 rounded hover:bg-[var(--bg-border)] text-[var(--text-muted)] hover:text-[var(--success)] transition-colors"
              >
                <Plus className="h-3.5 w-3.5" />
              </button>
              <span className="pointer-events-none absolute -top-8 right-0 whitespace-nowrap rounded px-2 py-1 text-xs bg-[var(--bg-elevated)] border border-[var(--bg-border)] text-[var(--text-secondary)] opacity-0 group-hover/tip:opacity-100 transition-opacity z-10">
                {t('plano_addChild')}
              </span>
            </div>
            <button
              onClick={() => onEdit(plan)}
              className="cursor-pointer p-1.5 rounded hover:bg-[var(--bg-border)] text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors"
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
          </div>
        </td>
      )}
    </tr>
  )
}

// ── Page ──────────────────────────────────────────────────────

export function Component() {
  const t = useT()
  const { id, isExternal } = useCompanyContext()
  const qc = useQueryClient()
  const { error: toastError } = useToast()

  // Accountants always manage their own chart — write enabled for both types
  const canWrite = true

  const [modalOpen,  setModalOpen]  = useState(false)
  const [editing,    setEditing]    = useState<AccountPlan | null>(null)
  const [preset,     setPreset]     = useState<AccountPlanModalProps['preset']>(null)
  const [collapsed,  setCollapsed]  = useState<Set<string>>(new Set())
  const [sections,   setSections]   = useState<Set<AccountType>>(new Set()) // collapsed sections
  const [fromScratch, setFromScratch] = useState(false)
  const [seeding,    setSeeding]    = useState(false)

  const [search,      setSearch]      = useState('')
  const [filterType,  setFilterType]  = useState('')
  const hasFilter = !!(search || filterType)

  const queryKey    = ['account-plans', id]
  const companyParam = isExternal ? `extCompanyId=${id}` : `companyId=${id}`

  const { data: plans = [], isLoading } = useQuery({
    queryKey,
    queryFn: () => apiFetch<AccountPlan[]>(`/api/account-plans?${companyParam}`),
    enabled: !!id,
  })

  const handleSubmit = async (data: {
    code: string; name: string; account_type: string; nature: string; is_analytic: boolean; parent_id: string | null
  }) => {
    const payload = { ...data, ...(isExternal ? { extCompanyId: id } : { companyId: id }) }
    if (editing) {
      await apiFetch(`/api/account-plans/${editing.id}`, { method: 'PATCH', body: JSON.stringify(payload) })
    } else {
      await apiFetch('/api/account-plans', { method: 'POST', body: JSON.stringify(payload) })
    }
    qc.invalidateQueries({ queryKey })
    setEditing(null); setPreset(null)
  }

  const toggleRow     = (id: string) => setCollapsed(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s })
  const toggleSection = (type: AccountType) => setSections(prev => { const s = new Set(prev); s.has(type) ? s.delete(type) : s.add(type); return s })

  const openCreate = (type?: AccountType) => {
    setEditing(null); setPreset(null)
    if (type) setPreset({ account_type: type, parent_id: '', parent_code: '' } as any)
    setModalOpen(true)
  }

  const openEdit = (plan: AccountPlan) => {
    setEditing(plan); setPreset(null); setModalOpen(true)
  }

  const openAddChild = (plan: AccountPlan) => {
    setEditing(null)
    setPreset({ account_type: plan.account_type, parent_id: plan.id, parent_code: plan.code })
    setModalOpen(true)
  }

  const handleSeedCfc = async () => {
    setSeeding(true)
    try {
      await seedAccountPlan(isExternal ? { extCompanyId: id } : { companyId: id })
      qc.invalidateQueries({ queryKey })
    } catch {
      toastError(t('plano_seedError'))
    } finally {
      setSeeding(false)
    }
  }

  // Filter plans for search/type filter
  const filtered = hasFilter
    ? plans.filter(p => {
        const matchSearch = !search || p.name.toLowerCase().includes(search.toLowerCase()) || p.code.includes(search)
        const matchType   = !filterType || p.account_type === filterType
        return matchSearch && matchType
      })
    : plans

  // Show first-access screen when empty and not in "from scratch" mode
  const showFirstAccess = !isLoading && plans.length === 0 && !fromScratch

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-[var(--text-primary)]">{t('plano_title')}</h1>
          {plans.length > 0 && (
            <p className="text-sm text-[var(--text-muted)]">
              {plans.length} {plans.length !== 1 ? t('plano_countPlural') : t('plano_countSingular')}
            </p>
          )}
        </div>
        {canWrite && plans.length > 0 && (
          <Button size="sm" onClick={() => openCreate()}>
            <Plus className="h-4 w-4" />
            {t('plano_new')}
          </Button>
        )}
      </div>

      {/* First access */}
      {showFirstAccess && (
        <FirstAccess
          onSeed={handleSeedCfc}
          onSkip={() => setFromScratch(true)}
          seeding={seeding}
        />
      )}

      {/* Filter bar — only when plans exist */}
      {plans.length > 0 && (
        <Card padding="sm">
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
              value={filterType}
              onChange={setFilterType}
              className="w-44"
              options={[
                { value: '',                   label: t('plano_filterAllTypes')      },
                { value: 'ativo',              label: t('plano_ativo')               },
                { value: 'passivo',            label: t('plano_passivo')             },
                { value: 'patrimonio_liquido', label: t('plano_patrimonioLiquido')   },
                { value: 'receita',            label: t('plano_receita')             },
                { value: 'despesa',            label: t('plano_despesa')             },
                { value: 'custo',              label: t('plano_custo')               },
              ]}
            />
            {hasFilter && (
              <button
                onClick={() => { setSearch(''); setFilterType('') }}
                className="cursor-pointer flex items-center gap-1 text-xs text-[var(--text-muted)] hover:text-[var(--danger)] transition-colors"
              >
                <X className="h-3.5 w-3.5" />
                {t('plano_clearFilters')}
              </button>
            )}
          </div>
        </Card>
      )}

      {/* Sections */}
      {(plans.length > 0 || fromScratch) && (
        <div className="flex flex-col gap-4">
          {ACCOUNT_SECTIONS.map(({ type, labelKey, color, subtleColor }) => {
            const sectionPlans = hasFilter
              ? filtered.filter(p => p.account_type === type)
              : plans.filter(p => p.account_type === type)

            const isCollapsedSection = sections.has(type)

            // In filter mode, skip empty sections
            if (hasFilter && sectionPlans.length === 0) return null

            const visibleRows = hasFilter
              ? sectionPlans.slice().sort((a, b) => a.code.localeCompare(b.code))
              : sectionPlans
                  .slice()
                  .sort((a, b) => a.code.localeCompare(b.code))
                  .filter(p => isVisible(p, plans, collapsed))

            return (
              <div key={type} className="rounded-[var(--radius-lg)] border border-[var(--bg-border)] overflow-hidden">
                <SectionHeader
                  label={t(labelKey as any)}
                  count={sectionPlans.length}
                  color={color}
                  subtleColor={subtleColor}
                  collapsed={isCollapsedSection}
                  onToggle={() => toggleSection(type)}
                  onAdd={() => openCreate(type)}
                  canWrite={canWrite}
                />

                {!isCollapsedSection && (
                  sectionPlans.length === 0 ? (
                    <div className="px-4 py-6 text-center">
                      <p className="text-xs text-[var(--text-muted)]">{t('plano_sectionEmpty')}</p>
                      {canWrite && (
                        <button
                          onClick={() => openCreate(type)}
                          className="mt-2 text-xs text-[var(--accent)] hover:underline cursor-pointer"
                        >
                          <Plus className="inline h-3 w-3 mr-0.5" />
                          Nova conta
                        </button>
                      )}
                    </div>
                  ) : (
                    <table className="w-full text-sm">
                      <tbody>
                        {visibleRows.map(plan => (
                          <AccountRow
                            key={plan.id}
                            plan={plan}
                            plans={plans}
                            collapsed={collapsed}
                            onToggle={toggleRow}
                            onEdit={openEdit}
                            onAddChild={openAddChild}
                            canWrite={canWrite}
                            hasFilter={hasFilter}
                          />
                        ))}
                      </tbody>
                    </table>
                  )
                )}
              </div>
            )
          })}
        </div>
      )}

      <AccountPlanModal
        open={modalOpen}
        onClose={() => { setModalOpen(false); setEditing(null); setPreset(null) }}
        onSubmit={handleSubmit}
        allPlans={plans}
        editing={editing}
        preset={preset}
      />
    </div>
  )
}
