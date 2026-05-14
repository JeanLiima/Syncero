import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { format, startOfMonth, endOfMonth } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { TrendingUp, TrendingDown, DollarSign, Plus } from 'lucide-react'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { Link } from 'react-router-dom'
import { Card, Badge, Button, MonthPicker } from '@syncero/ui'
import { useAuthStore } from '@/store/auth'
import { usePreferencesStore } from '@/store/preferences'
import { useT } from '@/i18n'
import { getTransactions } from '@/lib/backend'
import { TransactionWizard } from '@/modules/transactions/TransactionWizard'

const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

function periodToRef(period: string) {
  const year = Number(period.slice(0, 4))
  const month = Number(period.slice(5, 7))
  return new Date(year, month - 1, 1)
}

function useMonthSummary(period: string) {
  const activeCompany = useAuthStore((s) => s.activeCompany)
  const ref      = periodToRef(period)
  const dateFrom = format(startOfMonth(ref), 'yyyy-MM-dd')
  const dateTo   = format(endOfMonth(ref),   'yyyy-MM-dd')

  return useQuery({
    queryKey: ['dashboard-summary', activeCompany?.id, period],
    queryFn: async () => {
      if (!activeCompany?.id) return { income: 0, expense: 0 }
      const txRes = await getTransactions({
        companyId: activeCompany.id,
        date_from: dateFrom,
        date_to: dateTo,
        page: '1',
        pageSize: '1000',
      })
      const income  = txRes.data?.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0) ?? 0
      const expense = txRes.data?.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0) ?? 0
      return { income, expense }
    },
    enabled: !!activeCompany?.id,
  })
}

function useMonthChart(period: string) {
  const activeCompany = useAuthStore((s) => s.activeCompany)
  const ref      = periodToRef(period)
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
  const ref      = periodToRef(period)
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

export function Component() {
  const t = useT()
  const language = usePreferencesStore((s) => s.language)
  const [period, setPeriod] = useState(() => format(new Date(), 'yyyy-MM'))
  const { data: summary } = useMonthSummary(period)
  const { data: chartData = [] } = useMonthChart(period)
  const { data: recent = [] } = useRecentTransactions(period)
  const activeCompany = useAuthStore((s) => s.activeCompany)
  const [wizardOpen, setWizardOpen] = useState(false)

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
    { labelKey: 'dashboard_monthIncome'  as const, value: summary?.income ?? 0,  icon: <TrendingUp   className="h-5 w-5 text-[var(--success)]" />, color: 'text-[var(--success)]' },
    { labelKey: 'dashboard_monthExpense' as const, value: summary?.expense ?? 0, icon: <TrendingDown  className="h-5 w-5 text-[var(--danger)]" />,  color: 'text-[var(--danger)]' },
    { labelKey: 'dashboard_netResult'    as const, value: net,                    icon: <DollarSign   className="h-5 w-5 text-[var(--accent)]" />,   color: net >= 0 ? 'text-[var(--success)]' : 'text-[var(--danger)]' },
  ]

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-xl font-semibold text-[var(--text-primary)]">{t('dashboard_title')}</h1>
        <MonthPicker value={period} onChange={setPeriod} language={language} size="sm" />
      </div>

      {/* Metric cards */}
      <div className="grid grid-cols-3 gap-4">
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
