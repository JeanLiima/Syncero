import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { format, subDays, startOfMonth, endOfMonth, addDays } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts'
import { Card, Select, DateRangePicker, Skeleton } from '@syncero/ui'
import { useCashFlow } from '@/modules/cashFlow/queries'
import { useT } from '@/i18n'
import { usePreferencesStore } from '@/store/preferences'
import { useAuthStore } from '@/store/auth'
import { getPayables } from '@/lib/backend'

type Preset = '30d' | 'month' | '90d' | 'custom'

const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

function presetDates(preset: Preset): { dateFrom: string; dateTo: string } {
  const now = new Date()
  if (preset === 'month') return {
    dateFrom: format(startOfMonth(now), 'yyyy-MM-dd'),
    dateTo:   format(endOfMonth(now),   'yyyy-MM-dd'),
  }
  if (preset === '90d') return {
    dateFrom: format(subDays(now, 89), 'yyyy-MM-dd'),
    dateTo:   format(now,              'yyyy-MM-dd'),
  }
  return {
    dateFrom: format(subDays(now, 29), 'yyyy-MM-dd'),
    dateTo:   format(now,              'yyyy-MM-dd'),
  }
}

function useProjection(enabled: boolean) {
  const activeCompany = useAuthStore((s) => s.activeCompany)
  const today = format(new Date(), 'yyyy-MM-dd')
  const in30Days = format(addDays(new Date(), 30), 'yyyy-MM-dd')

  return useQuery({
    queryKey: ['cashflow-projection', activeCompany?.id],
    queryFn: async () => {
      if (!activeCompany?.id) return []
      const [payables, receivables] = await Promise.all([
        getPayables(activeCompany.id, 'payable'),
        getPayables(activeCompany.id, 'receivable'),
      ])
      const pending = [...payables, ...receivables].filter(
        (p) => p.status !== 'paid' && p.status !== 'cancelled'
          && p.due_date > today && p.due_date <= in30Days
      )
      const map = new Map<string, { income: number; expense: number }>()
      for (const p of pending) {
        const entry = map.get(p.due_date) ?? { income: 0, expense: 0 }
        if (p.type === 'receivable') entry.income += p.amount
        else entry.expense += p.amount
        map.set(p.due_date, entry)
      }
      return Array.from(map.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([date, vals]) => ({ date, ...vals }))
    },
    enabled: enabled && !!activeCompany?.id,
  })
}

export function Component() {
  const t = useT()
  const { language } = usePreferencesStore()
  const [preset, setPreset]     = useState<Preset>('30d')
  const [dateFrom, setDateFrom] = useState(() => presetDates('30d').dateFrom)
  const [dateTo,   setDateTo]   = useState(() => presetDates('30d').dateTo)
  const [showForecast, setShowForecast] = useState(false)

  const { data = [], isLoading } = useCashFlow(dateFrom, dateTo)
  const { data: projection = [] } = useProjection(showForecast)

  const handlePreset = (v: string) => {
    const p = v as Preset
    setPreset(p)
    const { dateFrom: f, dateTo: to } = presetDates(p)
    setDateFrom(f)
    setDateTo(to)
  }

  const handleRange = (f: string, to: string) => {
    setDateFrom(f)
    setDateTo(to)
    setPreset('custom')
  }

  const totalIncome  = data.reduce((s, d) => s + d.income, 0)
  const totalExpense = data.reduce((s, d) => s + d.expense, 0)
  const netBalance   = totalIncome - totalExpense

  type ChartPoint = { date: string; income?: number; expense?: number; balance?: number; forecast?: number }

  const chartData: ChartPoint[] = data.map((d) => ({
    ...d,
    date: format(new Date(d.date + 'T00:00:00'), 'dd/MM', { locale: ptBR }),
  }))

  if (showForecast && projection.length > 0) {
    const lastBalance = data.length > 0 ? data[data.length - 1].balance : 0
    let runningBalance = lastBalance
    for (const p of projection) {
      runningBalance += p.income - p.expense
      chartData.push({
        date: format(new Date(p.date + 'T00:00:00'), 'dd/MM', { locale: ptBR }),
        forecast: runningBalance,
      })
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-xl font-semibold text-[var(--text-primary)]">{t('cashFlow_title')}</h1>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setShowForecast((v) => !v)}
            className={`text-xs px-3 py-1.5 rounded-lg border transition-colors cursor-pointer ${
              showForecast
                ? 'bg-[var(--accent)] border-[var(--accent)] text-white'
                : 'bg-transparent border-[var(--bg-border)] text-[var(--text-muted)] hover:border-[var(--accent)] hover:text-[var(--accent)]'
            }`}
          >
            {showForecast ? t('cashFlow_hideForecast') : t('cashFlow_showForecast')}
          </button>
          <Select
            size="sm"
            options={[
              { value: '30d',    label: t('cashFlow_last30') },
              { value: 'month',  label: t('cashFlow_thisMonth') },
              { value: '90d',    label: t('cashFlow_last90') },
              { value: 'custom', label: t('cashFlow_custom') },
            ]}
            value={preset}
            onChange={handlePreset}
            className="w-44"
          />
          <DateRangePicker
            size="sm"
            from={dateFrom}
            to={dateTo}
            onChange={handleRange}
            language={language}
          />
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4">
        {isLoading ? Array.from({ length: 3 }).map((_, i) => (
          <Card key={i}>
            <Skeleton className="h-3 w-16 mb-3" />
            <Skeleton className="h-7 w-32" />
          </Card>
        )) : (<>
          <Card>
            <p className="text-xs text-[var(--text-muted)] mb-1">{t('cashFlow_income')}</p>
            <p className="text-xl font-semibold font-mono text-[var(--success)]">{fmt(totalIncome)}</p>
          </Card>
          <Card>
            <p className="text-xs text-[var(--text-muted)] mb-1">{t('cashFlow_expense')}</p>
            <p className="text-xl font-semibold font-mono text-[var(--danger)]">{fmt(totalExpense)}</p>
          </Card>
          <Card>
            <p className="text-xs text-[var(--text-muted)] mb-1">{t('cashFlow_result')}</p>
            <p className={`text-xl font-semibold font-mono ${netBalance >= 0 ? 'text-[var(--success)]' : 'text-[var(--danger)]'}`}>
              {fmt(netBalance)}
            </p>
          </Card>
        </>)}
      </div>

      {/* Chart */}
      <Card>
        <h2 className="text-sm font-medium text-[var(--text-secondary)] mb-4">{t('cashFlow_chartTitle')}</h2>
        {isLoading ? (
          <Skeleton className="h-[300px] w-full" />
        ) : data.length === 0 ? (
          <div className="h-64 flex items-center justify-center text-[var(--text-muted)] text-sm">
            {t('cashFlow_noEntries')}
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={chartData} margin={{ top: 5, right: 10, left: 10, bottom: 0 }}>
              <defs>
                <linearGradient id="colorIncome" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="colorExpense" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#f43f5e" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="colorBalance" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#0e7490" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#0e7490" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="colorForecast" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e2d45" />
              <XAxis dataKey="date" tick={{ fill: '#475569', fontSize: 11 }} />
              <YAxis
                tick={{ fill: '#475569', fontSize: 11 }}
                tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`}
              />
              <Tooltip
                contentStyle={{ background: '#111827', border: '1px solid #1e2d45', borderRadius: 8 }}
                labelStyle={{ color: '#94a3b8' }}
                formatter={(v: number) => fmt(v)}
              />
              <Legend wrapperStyle={{ fontSize: 12, color: '#94a3b8' }} />
              <Area type="monotone" dataKey="income"  name={t('cashFlow_income')}  stroke="#10b981" fill="url(#colorIncome)"  strokeWidth={2} connectNulls={false} />
              <Area type="monotone" dataKey="expense" name={t('cashFlow_expense')} stroke="#f43f5e" fill="url(#colorExpense)" strokeWidth={2} connectNulls={false} />
              <Area type="monotone" dataKey="balance" name={t('cashFlow_balance')} stroke="#0e7490" fill="url(#colorBalance)" strokeWidth={2} connectNulls={false} />
              {showForecast && (
                <Area
                  type="monotone"
                  dataKey="forecast"
                  name={t('cashFlow_forecast')}
                  stroke="#8b5cf6"
                  fill="url(#colorForecast)"
                  strokeWidth={2}
                  strokeDasharray="6 3"
                  connectNulls={false}
                />
              )}
            </AreaChart>
          </ResponsiveContainer>
        )}
      </Card>
    </div>
  )
}
