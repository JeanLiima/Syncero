import { useState } from 'react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts'
import { Card, Select } from '@syncero/ui'
import { useCashFlow } from '@/modules/fluxo/queries'

type Period = '30d' | 'month' | '90d'

const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

export function Component() {
  const [period, setPeriod] = useState<Period>('30d')
  const { data = [], isLoading } = useCashFlow(period)

  const totalIncome  = data.reduce((s, d) => s + d.income, 0)
  const totalExpense = data.reduce((s, d) => s + d.expense, 0)
  const netBalance   = totalIncome - totalExpense

  const chartData = data.map((d) => ({
    ...d,
    date: format(new Date(d.date + 'T00:00:00'), 'dd/MM', { locale: ptBR }),
  }))

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-[var(--text-primary)]">Fluxo de Caixa</h1>
        <Select
          options={[
            { value: '30d',   label: 'Últimos 30 dias' },
            { value: 'month', label: 'Este mês' },
            { value: '90d',   label: 'Últimos 90 dias' },
          ]}
          value={period}
          onChange={(v) => setPeriod(v as Period)}
          className="w-44"
        />
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <p className="text-xs text-[var(--text-muted)] mb-1">Receitas</p>
          <p className="text-xl font-semibold font-mono text-[var(--success)]">{fmt(totalIncome)}</p>
        </Card>
        <Card>
          <p className="text-xs text-[var(--text-muted)] mb-1">Despesas</p>
          <p className="text-xl font-semibold font-mono text-[var(--danger)]">{fmt(totalExpense)}</p>
        </Card>
        <Card>
          <p className="text-xs text-[var(--text-muted)] mb-1">Resultado</p>
          <p className={`text-xl font-semibold font-mono ${netBalance >= 0 ? 'text-[var(--success)]' : 'text-[var(--danger)]'}`}>
            {fmt(netBalance)}
          </p>
        </Card>
      </div>

      {/* Chart */}
      <Card>
        <h2 className="text-sm font-medium text-[var(--text-secondary)] mb-4">Evolução do caixa</h2>
        {isLoading ? (
          <div className="h-64 flex items-center justify-center text-[var(--text-muted)] text-sm">
            Carregando…
          </div>
        ) : data.length === 0 ? (
          <div className="h-64 flex items-center justify-center text-[var(--text-muted)] text-sm">
            Nenhum lançamento no período
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
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
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
              <Area type="monotone" dataKey="income"  name="Receitas"  stroke="#10b981" fill="url(#colorIncome)"  strokeWidth={2} />
              <Area type="monotone" dataKey="expense" name="Despesas"  stroke="#f43f5e" fill="url(#colorExpense)" strokeWidth={2} />
              <Area type="monotone" dataKey="balance" name="Saldo"     stroke="#3b82f6" fill="url(#colorBalance)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </Card>
    </div>
  )
}
