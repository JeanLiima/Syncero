import { useState } from 'react'
import { format, subDays, startOfMonth, endOfMonth } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts'
import { Card, Select, DateRangePicker, Skeleton } from '@syncero/ui'
import { useCashFlow } from '@/modules/cashFlow/queries'
import { useT } from '@/i18n'
import { usePreferencesStore } from '@/store/preferences'

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

export function Component() {
  const t = useT()
  const { language } = usePreferencesStore()
  const [preset, setPreset]   = useState<Preset>('30d')
  const [dateFrom, setDateFrom] = useState(() => presetDates('30d').dateFrom)
  const [dateTo,   setDateTo]   = useState(() => presetDates('30d').dateTo)

  const { data = [], isLoading } = useCashFlow(dateFrom, dateTo)

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

  const chartData = data.map((d) => ({
    ...d,
    date: format(new Date(d.date + 'T00:00:00'), 'dd/MM', { locale: ptBR }),
  }))

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-xl font-semibold text-[var(--text-primary)]">{t('cashFlow_title')}</h1>
        <div className="flex items-center gap-2 flex-wrap">
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
              <Area type="monotone" dataKey="income"  name={t('cashFlow_income')}  stroke="#10b981" fill="url(#colorIncome)"  strokeWidth={2} />
              <Area type="monotone" dataKey="expense" name={t('cashFlow_expense')} stroke="#f43f5e" fill="url(#colorExpense)" strokeWidth={2} />
              <Area type="monotone" dataKey="balance" name={t('cashFlow_balance')} stroke="#0e7490" fill="url(#colorBalance)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </Card>
    </div>
  )
}
