import { useQuery } from '@tanstack/react-query'
import { format, startOfMonth, endOfMonth, subDays } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { TrendingUp, TrendingDown, DollarSign, Clock } from 'lucide-react'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { Link } from 'react-router-dom'
import { Card, Badge, Button } from '@/components/ui'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/auth'

const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

function useMonthSummary() {
  const activeCompany = useAuthStore((s) => s.activeCompany)
  const now = new Date()
  const dateFrom = format(startOfMonth(now), 'yyyy-MM-dd')
  const dateTo   = format(endOfMonth(now),   'yyyy-MM-dd')

  return useQuery({
    queryKey: ['dashboard-summary', activeCompany?.id],
    queryFn: async () => {
      if (!activeCompany?.id) return { income: 0, expense: 0, toReceive: 0 }

      const [txRes, prRes] = await Promise.all([
        supabase
          .from('transactions')
          .select('type, amount')
          .eq('company_id', activeCompany.id)
          .gte('date', dateFrom)
          .lte('date', dateTo),
        supabase
          .from('payables_receivables')
          .select('amount')
          .eq('company_id', activeCompany.id)
          .eq('type', 'receivable')
          .eq('status', 'pending'),
      ])

      const income  = txRes.data?.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0) ?? 0
      const expense = txRes.data?.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0) ?? 0
      const toReceive = prRes.data?.reduce((s, t) => s + t.amount, 0) ?? 0

      return { income, expense, toReceive }
    },
    enabled: !!activeCompany?.id,
  })
}

function useLast30Days() {
  const activeCompany = useAuthStore((s) => s.activeCompany)
  const dateFrom = format(subDays(new Date(), 29), 'yyyy-MM-dd')
  const dateTo   = format(new Date(), 'yyyy-MM-dd')

  return useQuery({
    queryKey: ['dashboard-chart', activeCompany?.id],
    queryFn: async () => {
      if (!activeCompany?.id) return []
      const { data, error } = await supabase
        .from('transactions')
        .select('date, amount, type')
        .eq('company_id', activeCompany.id)
        .gte('date', dateFrom)
        .lte('date', dateTo)
        .order('date')
      if (error) throw error

      const map = new Map<string, { income: number; expense: number }>()
      for (const t of data ?? []) {
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

function useRecentTransactions() {
  const activeCompany = useAuthStore((s) => s.activeCompany)

  return useQuery({
    queryKey: ['dashboard-recent', activeCompany?.id],
    queryFn: async () => {
      if (!activeCompany?.id) return []
      const { data, error } = await supabase
        .from('transactions')
        .select('id, description, amount, type, date, is_paid')
        .eq('company_id', activeCompany.id)
        .order('date', { ascending: false })
        .limit(5)
      if (error) throw error
      return data ?? []
    },
    enabled: !!activeCompany?.id,
  })
}

export function Component() {
  const { data: summary } = useMonthSummary()
  const { data: chartData = [] } = useLast30Days()
  const { data: recent = [] } = useRecentTransactions()
  const activeCompany = useAuthStore((s) => s.activeCompany)

  if (!activeCompany) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4 text-center">
        <div className="h-12 w-12 rounded-xl bg-[var(--bg-elevated)] flex items-center justify-center">
          <TrendingUp className="h-6 w-6 text-[var(--text-muted)]" />
        </div>
        <div>
          <p className="text-sm font-medium text-[var(--text-primary)]">Nenhuma empresa criada</p>
          <p className="text-xs text-[var(--text-muted)] mt-1">Crie sua empresa para começar a usar o Finflow</p>
        </div>
        <Link to="/configuracoes">
          <Button size="sm">Criar empresa</Button>
        </Link>
      </div>
    )
  }

  const net = (summary?.income ?? 0) - (summary?.expense ?? 0)

  const metrics = [
    { label: 'Receita do mês', value: summary?.income ?? 0, icon: <TrendingUp className="h-5 w-5 text-[var(--success)]" />, color: 'text-[var(--success)]' },
    { label: 'Despesas do mês', value: summary?.expense ?? 0, icon: <TrendingDown className="h-5 w-5 text-[var(--danger)]" />, color: 'text-[var(--danger)]' },
    { label: 'Resultado', value: net, icon: <DollarSign className="h-5 w-5 text-[var(--accent)]" />, color: net >= 0 ? 'text-[var(--success)]' : 'text-[var(--danger)]' },
    { label: 'A receber', value: summary?.toReceive ?? 0, icon: <Clock className="h-5 w-5 text-[var(--warning)]" />, color: 'text-[var(--warning)]' },
  ]

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-[var(--text-primary)]">Dashboard</h1>
        <p className="text-sm text-[var(--text-muted)]">
          {format(new Date(), "MMMM 'de' yyyy", { locale: ptBR })}
        </p>
      </div>

      {/* Metric cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {metrics.map((m) => (
          <Card key={m.label}>
            <div className="flex items-start justify-between mb-3">
              <p className="text-xs text-[var(--text-muted)]">{m.label}</p>
              {m.icon}
            </div>
            <p className={`text-xl font-semibold font-mono ${m.color}`}>{fmt(m.value)}</p>
          </Card>
        ))}
      </div>

      {/* Chart */}
      <Card>
        <h2 className="text-sm font-medium text-[var(--text-secondary)] mb-4">Últimos 30 dias</h2>
        {chartData.length === 0 ? (
          <div className="h-48 flex items-center justify-center text-[var(--text-muted)] text-sm">
            Nenhum lançamento no período
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
              <Area type="monotone" dataKey="income"  name="Receitas" stroke="#10b981" fill="url(#gi)" strokeWidth={2} />
              <Area type="monotone" dataKey="expense" name="Despesas" stroke="#f43f5e" fill="url(#ge)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </Card>

      {/* Recent transactions */}
      <Card>
        <h2 className="text-sm font-medium text-[var(--text-secondary)] mb-4">Últimos lançamentos</h2>
        {recent.length === 0 ? (
          <p className="text-sm text-[var(--text-muted)] text-center py-4">Nenhum lançamento ainda</p>
        ) : (
          <div className="flex flex-col divide-y divide-[var(--bg-border)]">
            {recent.map((t) => (
              <div key={t.id} className="flex items-center justify-between py-3">
                <div className="flex items-center gap-3">
                  <div className={`h-2 w-2 rounded-full ${t.type === 'income' ? 'bg-[var(--success)]' : 'bg-[var(--danger)]'}`} />
                  <div>
                    <p className="text-sm text-[var(--text-primary)]">{t.description}</p>
                    <p className="text-xs text-[var(--text-muted)]">
                      {format(new Date(t.date + 'T00:00:00'), 'dd/MM/yyyy', { locale: ptBR })}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={t.is_paid ? 'success' : 'warning'}>{t.is_paid ? 'Pago' : 'Pendente'}</Badge>
                  <span className={`font-mono text-sm font-medium ${t.type === 'income' ? 'text-[var(--success)]' : 'text-[var(--danger)]'}`}>
                    {t.type === 'income' ? '+' : '-'} {fmt(t.amount)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  )
}
