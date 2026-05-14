import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { format, startOfMonth, endOfMonth, addDays } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { TrendingUp, TrendingDown, DollarSign, Clock, Plus, AlertCircle, CheckCircle2, CalendarClock } from 'lucide-react'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { Link } from 'react-router-dom'
import { Card, Badge, Button, MonthPicker } from '@syncero/ui'
import { useAuthStore } from '@/store/auth'
import { usePreferencesStore } from '@/store/preferences'
import { useT } from '@/i18n'
import { getTransactions, getPayables, updatePayable } from '@/lib/backend'
import type { PayableReceivable } from '@/types'
import { TransactionWizard } from '@/modules/transactions/TransactionWizard'

const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

function useMonthSummary(period: string) {
  const activeCompany = useAuthStore((s) => s.activeCompany)
  const ref      = new Date(period + '-01')
  const dateFrom = format(startOfMonth(ref), 'yyyy-MM-dd')
  const dateTo   = format(endOfMonth(ref),   'yyyy-MM-dd')

  return useQuery({
    queryKey: ['dashboard-summary', activeCompany?.id, period],
    queryFn: async () => {
      if (!activeCompany?.id) return { income: 0, expense: 0, toReceive: 0 }

      const [txRes, prRes] = await Promise.all([
        getTransactions({
          companyId: activeCompany.id,
          date_from: dateFrom,
          date_to: dateTo,
          page: '1',
          pageSize: '1000',
        }),
        getPayables(activeCompany.id, 'receivable'),
      ])

      const income  = txRes.data?.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0) ?? 0
      const expense = txRes.data?.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0) ?? 0
      const toReceive = prRes
        .filter((t) => t.status !== 'paid' && t.status !== 'cancelled')
        .reduce((s, t) => s + t.amount, 0)

      return { income, expense, toReceive }
    },
    enabled: !!activeCompany?.id,
  })
}

function useMonthChart(period: string) {
  const activeCompany = useAuthStore((s) => s.activeCompany)
  const ref      = new Date(period + '-01')
  const dateFrom = format(startOfMonth(ref), 'yyyy-MM-dd')
  const dateTo   = format(endOfMonth(ref),   'yyyy-MM-dd')

  return useQuery({
    queryKey: ['dashboard-chart', activeCompany?.id, period],
    queryFn: async () => {
      if (!activeCompany?.id) return []
      const result = await getTransactions({
        companyId: activeCompany.id,
        date_from: dateFrom,
        date_to: dateTo,
        page: '1',
        pageSize: '1000',
      })

      const map = new Map<string, { income: number; expense: number }>()
      for (const t of result.data ?? []) {
        const existing = map.get(t.date) ?? { income: 0, expense: 0 }
        if (t.type === 'income') existing.income += t.amount
        else existing.expense += t.amount
        map.set(t.date, existing)
      }
      return Array.from(map.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([date, vals]) => ({
          date: format(new Date(date + 'T00:00:00'), 'dd/MM', { locale: ptBR }),
          ...vals,
        }))
    },
    enabled: !!activeCompany?.id,
  })
}

function useRecentTransactions(period: string) {
  const activeCompany = useAuthStore((s) => s.activeCompany)
  const ref      = new Date(period + '-01')
  const dateFrom = format(startOfMonth(ref), 'yyyy-MM-dd')
  const dateTo   = format(endOfMonth(ref),   'yyyy-MM-dd')

  return useQuery({
    queryKey: ['dashboard-recent', activeCompany?.id, period],
    queryFn: async () => {
      if (!activeCompany?.id) return []
      const result = await getTransactions({
        companyId: activeCompany.id,
        date_from: dateFrom,
        date_to: dateTo,
        page: '1',
        pageSize: '5',
      })
      return result.data ?? []
    },
    enabled: !!activeCompany?.id,
  })
}

function useUpcomingPayables() {
  const activeCompany = useAuthStore((s) => s.activeCompany)
  const today = format(new Date(), 'yyyy-MM-dd')
  const in7Days = format(addDays(new Date(), 7), 'yyyy-MM-dd')

  return useQuery({
    queryKey: ['dashboard-upcoming', activeCompany?.id],
    queryFn: async () => {
      if (!activeCompany?.id) return { overdue: [], today: [], next7: [] }
      const [payables, receivables] = await Promise.all([
        getPayables(activeCompany.id, 'payable'),
        getPayables(activeCompany.id, 'receivable'),
      ])
      const active = [...payables, ...receivables].filter(
        (p) => p.status !== 'paid' && p.status !== 'cancelled'
      )
      return {
        overdue: active.filter((p) => p.due_date < today),
        today:   active.filter((p) => p.due_date === today),
        next7:   active.filter((p) => p.due_date > today && p.due_date <= in7Days),
      }
    },
    enabled: !!activeCompany?.id,
  })
}

type DueGroup = { labelKey: 'dashboard_dueOverdue' | 'dashboard_dueToday' | 'dashboard_dueNext7'; items: PayableReceivable[]; icon: React.ReactNode; color: string }

function DueSection({ group }: { group: DueGroup }) {
  const t = useT()
  const qc = useQueryClient()
  const activeCompany = useAuthStore((s) => s.activeCompany)

  const markPaid = useMutation({
    mutationFn: (id: string) =>
      updatePayable(id, { status: 'paid', paid_date: format(new Date(), 'yyyy-MM-dd') }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['dashboard-upcoming', activeCompany?.id] })
      qc.invalidateQueries({ queryKey: ['dashboard-summary', activeCompany?.id] })
    },
  })

  if (group.items.length === 0) return null

  return (
    <div>
      <div className="flex items-center gap-1.5 mb-2">
        {group.icon}
        <span className={`text-xs font-semibold uppercase tracking-wide ${group.color}`}>{t(group.labelKey)}</span>
        <span className="text-xs text-[var(--text-muted)] ml-1">({group.items.length})</span>
      </div>
      <div className="flex flex-col divide-y divide-[var(--bg-border)]">
        {group.items.map((item) => (
          <div key={item.id} className="flex items-center justify-between py-2.5 gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-sm text-[var(--text-primary)] truncate">{item.description}</p>
              {item.contact_name && (
                <p className="text-xs text-[var(--text-muted)] truncate">{item.contact_name}</p>
              )}
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <Badge variant={item.type === 'payable' ? 'danger' : 'success'}>
                {item.type === 'payable' ? t('dashboard_dueTypePayable') : t('dashboard_dueTypeReceivable')}
              </Badge>
              <span className={`font-mono text-sm font-medium ${item.type === 'payable' ? 'text-[var(--danger)]' : 'text-[var(--success)]'}`}>
                {fmt(item.amount)}
              </span>
              <Button
                size="sm"
                variant={item.type === 'payable' ? 'primary' : 'ghost'}
                disabled={markPaid.isPending}
                onClick={() => markPaid.mutate(item.id)}
              >
                {item.type === 'payable' ? t('dashboard_duePay') : t('dashboard_dueReceive')}
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export function Component() {
  const t = useT()
  const language = usePreferencesStore((s) => s.language)
  const [period, setPeriod] = useState(() => new Date().toISOString().slice(0, 7))
  const { data: summary } = useMonthSummary(period)
  const { data: chartData = [] } = useMonthChart(period)
  const { data: recent = [] } = useRecentTransactions(period)
  const { data: upcoming } = useUpcomingPayables()
  const activeCompany = useAuthStore((s) => s.activeCompany)
  const [wizardOpen, setWizardOpen] = useState(false)

  // This case is now handled by NoCompanyShell in the router,
  // but kept as a fallback
  if (!activeCompany) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4 text-center">
        <div className="h-12 w-12 rounded-xl bg-[var(--bg-elevated)] flex items-center justify-center">
          <TrendingUp className="h-6 w-6 text-[var(--text-muted)]" />
        </div>
        <div>
          <p className="text-sm font-medium text-[var(--text-primary)]">{t('dashboard_noCompany')}</p>
          <p className="text-xs text-[var(--text-muted)] mt-1">{t('dashboard_noCompanyHint')}</p>
        </div>
        <Link to="/settings">
          <Button size="sm">{t('dashboard_createCompany')}</Button>
        </Link>
      </div>
    )
  }

  const net = (summary?.income ?? 0) - (summary?.expense ?? 0)

  const metrics = [
    { labelKey: 'dashboard_monthIncome'  as const, value: summary?.income ?? 0,    icon: <TrendingUp  className="h-5 w-5 text-[var(--success)]" />, color: 'text-[var(--success)]' },
    { labelKey: 'dashboard_monthExpense' as const, value: summary?.expense ?? 0,   icon: <TrendingDown className="h-5 w-5 text-[var(--danger)]" />,  color: 'text-[var(--danger)]' },
    { labelKey: 'dashboard_netResult'    as const, value: net,                      icon: <DollarSign  className="h-5 w-5 text-[var(--accent)]" />,   color: net >= 0 ? 'text-[var(--success)]' : 'text-[var(--danger)]' },
    { labelKey: 'dashboard_toReceive'    as const, value: summary?.toReceive ?? 0,  icon: <Clock       className="h-5 w-5 text-[var(--warning)]" />,   color: 'text-[var(--warning)]' },
  ]

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-xl font-semibold text-[var(--text-primary)]">{t('dashboard_title')}</h1>
        <MonthPicker value={period} onChange={setPeriod} language={language} size="sm" />
      </div>

      {/* Metric cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {metrics.map((m) => (
          <Card key={m.labelKey}>
            <div className="flex items-start justify-between mb-3">
              <p className="text-xs text-[var(--text-muted)]">{t(m.labelKey)}</p>
              {m.icon}
            </div>
            <p className={`text-xl font-semibold font-mono ${m.color}`}>{fmt(m.value)}</p>
          </Card>
        ))}
      </div>

      {/* Chart */}
      <Card>
        <h2 className="text-sm font-medium text-[var(--text-secondary)] mb-4">{t('dashboard_cashFlowChart')}</h2>
        {chartData.length === 0 ? (
          <div className="h-48 flex items-center justify-center text-[var(--text-muted)] text-sm">
            {t('dashboard_noTransactions')}
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={chartData} margin={{ top: 5, right: 5, left: 5, bottom: 0 }}>
              <defs>
                <linearGradient id="gi" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="ge" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#f43f5e" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e2d45" />
              <XAxis dataKey="date" tick={{ fill: '#475569', fontSize: 10 }} />
              <YAxis tick={{ fill: '#475569', fontSize: 10 }} tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} />
              <Tooltip
                contentStyle={{ background: '#111827', border: '1px solid #1e2d45', borderRadius: 8 }}
                formatter={(v: number) => fmt(v)}
              />
              <Area type="monotone" dataKey="income"  name={t('cashFlow_income')}  stroke="#10b981" fill="url(#gi)" strokeWidth={2} />
              <Area type="monotone" dataKey="expense" name={t('cashFlow_expense')} stroke="#f43f5e" fill="url(#ge)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </Card>

      {/* Due dates */}
      <Card>
        <h2 className="text-sm font-medium text-[var(--text-secondary)] mb-4">{t('dashboard_dueDates')}</h2>
        {(() => {
          const groups: DueGroup[] = [
            {
              labelKey: 'dashboard_dueOverdue',
              items: upcoming?.overdue ?? [],
              icon: <AlertCircle className="h-3.5 w-3.5 text-[var(--danger)]" />,
              color: 'text-[var(--danger)]',
            },
            {
              labelKey: 'dashboard_dueToday',
              items: upcoming?.today ?? [],
              icon: <CheckCircle2 className="h-3.5 w-3.5 text-[var(--warning)]" />,
              color: 'text-[var(--warning)]',
            },
            {
              labelKey: 'dashboard_dueNext7',
              items: upcoming?.next7 ?? [],
              icon: <CalendarClock className="h-3.5 w-3.5 text-[var(--text-muted)]" />,
              color: 'text-[var(--text-muted)]',
            },
          ]
          const total = groups.reduce((s, g) => s + g.items.length, 0)
          if (total === 0) {
            return <p className="text-sm text-[var(--text-muted)] text-center py-4">{t('dashboard_dueNone')}</p>
          }
          return (
            <div className="flex flex-col gap-4">
              {groups.map((g) => <DueSection key={g.labelKey} group={g} />)}
            </div>
          )
        })()}
      </Card>

      {/* Recent transactions */}
      <Card>
        <h2 className="text-sm font-medium text-[var(--text-secondary)] mb-4">{t('dashboard_recentTransactions')}</h2>
        {recent.length === 0 ? (
          <p className="text-sm text-[var(--text-muted)] text-center py-4">{t('dashboard_noTransactions')}</p>
        ) : (
          <div className="flex flex-col divide-y divide-[var(--bg-border)]">
            {recent.map((tx) => (
              <div key={tx.id} className="flex items-center justify-between py-3">
                <div className="flex items-center gap-3">
                  <div className={`h-2 w-2 rounded-full ${tx.type === 'income' ? 'bg-[var(--success)]' : 'bg-[var(--danger)]'}`} />
                  <div>
                    <p className="text-sm text-[var(--text-primary)]">{tx.description}</p>
                    <p className="text-xs text-[var(--text-muted)]">
                      {format(new Date(tx.date + 'T00:00:00'), 'dd/MM/yyyy', { locale: ptBR })}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <Badge variant={tx.is_paid ? 'success' : 'warning'}>
                    {tx.is_paid ? t('transactions_paid') : t('transactions_pending')}
                  </Badge>
                  <span className={`font-mono text-sm font-medium w-28 text-right ${tx.type === 'income' ? 'text-[var(--success)]' : 'text-[var(--danger)]'}`}>
                    {tx.type === 'income' ? '+' : '-'} {fmt(tx.amount)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* FAB */}
      <button
        onClick={() => setWizardOpen(true)}
        className="fixed bottom-8 right-8 z-40 flex items-center gap-2.5 h-13 px-5 rounded-full bg-[var(--accent)] text-white shadow-lg hover:brightness-110 active:scale-95 transition-all cursor-pointer"
        aria-label={t('dashboard_fab')}
      >
        <Plus className="h-5 w-5 shrink-0" />
        <span className="text-sm font-medium">{t('dashboard_fab')}</span>
      </button>

      <TransactionWizard
        open={wizardOpen}
        onClose={() => setWizardOpen(false)}
        editing={null}
        language={language}
      />
    </div>
  )
}
