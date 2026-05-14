import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { format, startOfMonth, endOfMonth } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { TrendingUp, TrendingDown, DollarSign, Plus } from 'lucide-react'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { Link } from 'react-router-dom'
import { Card, Badge, Button, MonthPicker, Modal, Skeleton } from '@syncero/ui'
import { useAuthStore } from '@/store/auth'
import { usePreferencesStore } from '@/store/preferences'
import { useT } from '@/i18n'
import { getTransactions } from '@/lib/backend'
import { useIncomeStatement } from '@/modules/incomeStatement/queries'
import { TransactionWizard } from '@/modules/transactions/TransactionWizard'

const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

function periodToRef(period: string) {
  const year  = Number(period.slice(0, 4))
  const month = Number(period.slice(5, 7))
  return new Date(year, month - 1, 1)
}

// ── Drill-down ────────────────────────────────────────────────

type DrillTarget = { categoryId: string | null; categoryName: string; type: 'income' | 'expense' }

function useDrillTransactions(target: DrillTarget | null, year: number, month: number) {
  const activeCompany = useAuthStore((s) => s.activeCompany)

  return useQuery({
    queryKey: ['dre-drill', activeCompany?.id, target?.categoryId, year, month],
    queryFn: async () => {
      if (!activeCompany?.id || !target) return []
      const date = new Date(year, month - 1, 1)
      const result = await getTransactions({
        companyId: activeCompany.id,
        type: target.type,
        category_id: target.categoryId ?? undefined,
        date_from: format(startOfMonth(date), 'yyyy-MM-dd'),
        date_to:   format(endOfMonth(date),   'yyyy-MM-dd'),
        page: '1',
        pageSize: '200',
      })
      return result.data ?? []
    },
    enabled: !!activeCompany?.id && !!target,
  })
}

function DrillDownModal({ target, year, month, onClose }: {
  target: DrillTarget | null; year: number; month: number; onClose: () => void
}) {
  const t = useT()
  const { data: rows = [], isLoading } = useDrillTransactions(target, year, month)
  const title = target
    ? `${target.categoryName} — ${format(new Date(year, month - 1, 1), 'MMMM yyyy', { locale: ptBR })}`
    : ''

  return (
    <Modal open={!!target} onClose={onClose} title={`${t('incomeStatement_drillDownTitle')}: ${title}`} size="lg">
      {isLoading ? (
        <div className="flex flex-col gap-3">
          {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
        </div>
      ) : rows.length === 0 ? (
        <p className="text-sm text-[var(--text-muted)] text-center py-6">{t('incomeStatement_drillDownEmpty')}</p>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--bg-border)]">
              <th className="py-2 text-left text-xs font-medium text-[var(--text-muted)]">Data</th>
              <th className="py-2 text-left text-xs font-medium text-[var(--text-muted)]">Descrição</th>
              <th className="py-2 text-right text-xs font-medium text-[var(--text-muted)]">Valor</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((tx) => (
              <tr key={tx.id} className="border-b border-[var(--bg-border)]">
                <td className="py-2.5 text-[var(--text-muted)] whitespace-nowrap pr-4">
                  {format(new Date(tx.date + 'T00:00:00'), 'dd/MM/yyyy')}
                </td>
                <td className="py-2.5 text-[var(--text-primary)]">{tx.description}</td>
                <td className={`py-2.5 text-right font-mono font-medium ${target?.type === 'income' ? 'text-[var(--success)]' : 'text-[var(--danger)]'}`}>
                  {fmt(tx.amount)}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={2} className="pt-3 font-semibold text-[var(--text-primary)]">Total</td>
              <td className={`pt-3 text-right font-mono font-semibold ${target?.type === 'income' ? 'text-[var(--success)]' : 'text-[var(--danger)]'}`}>
                {fmt(rows.reduce((s, r) => s + r.amount, 0))}
              </td>
            </tr>
          </tfoot>
        </table>
      )}
    </Modal>
  )
}

// ── Chart query ───────────────────────────────────────────────

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

// ── Page ──────────────────────────────────────────────────────

export function Component() {
  const t = useT()
  const language = usePreferencesStore((s) => s.language)
  const [period, setPeriod] = useState(() => format(new Date(), 'yyyy-MM'))
  const [drill, setDrill]   = useState<DrillTarget | null>(null)
  const [wizardOpen, setWizardOpen] = useState(false)

  const year  = Number(period.slice(0, 4))
  const month = Number(period.slice(5, 7))

  const { data: dreData = [], isLoading: dreLoading } = useIncomeStatement(year, month)
  const { data: chartData = [] }                       = useMonthChart(period)
  const { data: recent = [] }                          = useRecentTransactions(period)
  const activeCompany = useAuthStore((s) => s.activeCompany)

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

  const incomeRows   = dreData.filter((r) => r.type === 'income')
  const expenseRows  = dreData.filter((r) => r.type === 'expense')
  const totalIncome  = incomeRows.reduce((s, r) => s + r.total, 0)
  const totalExpense = expenseRows.reduce((s, r) => s + r.total, 0)
  const net          = totalIncome - totalExpense

  const openDrill = (categoryId: string | null, categoryName: string, type: 'income' | 'expense') =>
    setDrill({ categoryId, categoryName, type })

  const metrics = [
    { labelKey: 'dashboard_monthIncome'  as const, value: totalIncome,  icon: <TrendingUp  className="h-5 w-5 text-[var(--success)]" />, color: 'text-[var(--success)]' },
    { labelKey: 'dashboard_monthExpense' as const, value: totalExpense, icon: <TrendingDown className="h-5 w-5 text-[var(--danger)]" />,  color: 'text-[var(--danger)]' },
    { labelKey: 'dashboard_netResult'    as const, value: net,          icon: <DollarSign  className="h-5 w-5 text-[var(--accent)]" />,   color: net >= 0 ? 'text-[var(--success)]' : 'text-[var(--danger)]' },
  ]

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-xl font-semibold text-[var(--text-primary)]">{t('dashboard_title')}</h1>
        <MonthPicker value={period} onChange={setPeriod} language={language} size="sm" />
      </div>

      {/* Summary cards */}
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

      {/* Daily chart */}
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

      {/* Category breakdown */}
      <Card padding="sm">
        {dreLoading ? (
          <table className="w-full text-sm">
            <tbody>
              <tr className="bg-[var(--bg-elevated)]">
                <td colSpan={2} className="px-4 py-2"><Skeleton className="h-3 w-20" /></td>
              </tr>
              {Array.from({ length: 3 }).map((_, i) => (
                <tr key={`inc-${i}`} className="border-b border-[var(--bg-border)]">
                  <td className="px-4 py-3"><Skeleton className="h-4 w-40" /></td>
                  <td className="px-4 py-3 text-right"><Skeleton className="h-4 w-24 ml-auto" /></td>
                </tr>
              ))}
              <tr className="border-b-2 border-[var(--bg-border)]">
                <td className="px-4 py-3"><Skeleton className="h-4 w-32" /></td>
                <td className="px-4 py-3 text-right"><Skeleton className="h-4 w-24 ml-auto" /></td>
              </tr>
              <tr className="bg-[var(--bg-elevated)]">
                <td colSpan={2} className="px-4 py-2"><Skeleton className="h-3 w-20" /></td>
              </tr>
              {Array.from({ length: 3 }).map((_, i) => (
                <tr key={`exp-${i}`} className="border-b border-[var(--bg-border)]">
                  <td className="px-4 py-3"><Skeleton className="h-4 w-36" /></td>
                  <td className="px-4 py-3 text-right"><Skeleton className="h-4 w-24 ml-auto" /></td>
                </tr>
              ))}
              <tr className="bg-[var(--bg-elevated)]">
                <td className="px-4 py-4"><Skeleton className="h-5 w-28" /></td>
                <td className="px-4 py-4 text-right"><Skeleton className="h-5 w-28 ml-auto" /></td>
              </tr>
            </tbody>
          </table>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--bg-border)]">
                <th className="px-4 py-3 text-left text-xs font-medium text-[var(--text-muted)] capitalize tracking-wide">
                  {t('incomeStatement_category')}
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-[var(--text-muted)] capitalize tracking-wide">
                  {t('incomeStatement_result')}
                </th>
              </tr>
            </thead>
            <tbody>
              <tr className="bg-[var(--bg-elevated)]">
                <td colSpan={2} className="px-4 py-2 text-xs font-semibold text-[var(--success)] uppercase tracking-wide">
                  {t('incomeStatement_income')}
                </td>
              </tr>
              {incomeRows.length === 0 ? (
                <tr>
                  <td colSpan={2} className="px-4 py-3 text-[var(--text-muted)] italic text-xs">{t('incomeStatement_noIncome')}</td>
                </tr>
              ) : incomeRows.map((r) => (
                <tr
                  key={r.category_id ?? '__none_income'}
                  className="border-b border-[var(--bg-border)] hover:bg-[var(--bg-elevated)] cursor-pointer transition-colors"
                  onClick={() => openDrill(r.category_id, r.category_id === null ? t('incomeStatement_drillDownNoCategory') : r.category_name, 'income')}
                >
                  <td className="px-4 py-3 text-[var(--text-primary)]">
                    {r.category_id === null ? t('transactions_noCategory') : r.category_name}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-[var(--success)]">{fmt(r.total)}</td>
                </tr>
              ))}
              <tr className="border-b-2 border-[var(--bg-border)]">
                <td className="px-4 py-3 font-semibold text-[var(--text-primary)]">{t('incomeStatement_totalIncome')}</td>
                <td className="px-4 py-3 text-right font-mono font-semibold text-[var(--success)]">{fmt(totalIncome)}</td>
              </tr>

              <tr className="bg-[var(--bg-elevated)]">
                <td colSpan={2} className="px-4 py-2 text-xs font-semibold text-[var(--danger)] uppercase tracking-wide">
                  {t('incomeStatement_expense')}
                </td>
              </tr>
              {expenseRows.length === 0 ? (
                <tr>
                  <td colSpan={2} className="px-4 py-3 text-[var(--text-muted)] italic text-xs">{t('incomeStatement_noExpense')}</td>
                </tr>
              ) : expenseRows.map((r) => (
                <tr
                  key={r.category_id ?? '__none_expense'}
                  className="border-b border-[var(--bg-border)] hover:bg-[var(--bg-elevated)] cursor-pointer transition-colors"
                  onClick={() => openDrill(r.category_id, r.category_id === null ? t('incomeStatement_drillDownNoCategory') : r.category_name, 'expense')}
                >
                  <td className="px-4 py-3 text-[var(--text-primary)]">
                    {r.category_id === null ? t('transactions_noCategory') : r.category_name}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-[var(--danger)]">{fmt(r.total)}</td>
                </tr>
              ))}
              <tr className="border-b-2 border-[var(--bg-border)]">
                <td className="px-4 py-3 font-semibold text-[var(--text-primary)]">{t('incomeStatement_totalExpense')}</td>
                <td className="px-4 py-3 text-right font-mono font-semibold text-[var(--danger)]">{fmt(totalExpense)}</td>
              </tr>

              <tr className="bg-[var(--bg-elevated)]">
                <td className="px-4 py-4 font-bold text-[var(--text-primary)] text-base">{t('incomeStatement_netResult')}</td>
                <td className={`px-4 py-4 text-right font-mono font-bold text-base ${net >= 0 ? 'text-[var(--success)]' : 'text-[var(--danger)]'}`}>
                  {fmt(net)}
                </td>
              </tr>
            </tbody>
          </table>
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
        className="fixed bottom-8 right-8 z-40 group flex items-center h-12 pl-3.5 pr-3.5 rounded-full bg-[var(--accent)] text-white shadow-lg hover:brightness-110 active:scale-95 transition-all duration-200 cursor-pointer"
        aria-label={t('dashboard_fab')}
      >
        <Plus className="h-5 w-5 shrink-0" />
        <span className="text-sm font-medium whitespace-nowrap overflow-hidden max-w-0 ml-0 group-hover:max-w-[10rem] group-hover:ml-2.5 transition-all duration-200">
          {t('dashboard_fab')}
        </span>
      </button>

      <TransactionWizard
        open={wizardOpen}
        onClose={() => setWizardOpen(false)}
        editing={null}
        language={language}
      />

      <DrillDownModal target={drill} year={year} month={month} onClose={() => setDrill(null)} />
    </div>
  )
}
