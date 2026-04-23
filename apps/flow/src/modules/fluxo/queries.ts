import { useQuery } from '@tanstack/react-query'
import { useAuthStore } from '@/store/auth'
import { getTransactions } from '@/lib/backend'
import { format, subDays, startOfMonth, endOfMonth } from 'date-fns'

export interface DailyFlow {
  date: string
  income: number
  expense: number
  balance: number
}

export function useCashFlow(period: 'month' | '30d' | '90d' = '30d') {
  const activeCompany = useAuthStore((s) => s.activeCompany)

  const { dateFrom, dateTo } = (() => {
    const now = new Date()
    if (period === 'month') return {
      dateFrom: format(startOfMonth(now), 'yyyy-MM-dd'),
      dateTo: format(endOfMonth(now), 'yyyy-MM-dd'),
    }
    if (period === '90d') return {
      dateFrom: format(subDays(now, 89), 'yyyy-MM-dd'),
      dateTo: format(now, 'yyyy-MM-dd'),
    }
    return {
      dateFrom: format(subDays(now, 29), 'yyyy-MM-dd'),
      dateTo: format(now, 'yyyy-MM-dd'),
    }
  })()

  return useQuery({
    queryKey: ['cashflow', activeCompany?.id, period],
    queryFn: async (): Promise<DailyFlow[]> => {
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

      let accumulated = 0
      return Array.from(map.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([date, { income, expense }]) => {
          accumulated += income - expense
          return { date, income, expense, balance: accumulated }
        })
    },
    enabled: !!activeCompany?.id,
  })
}
