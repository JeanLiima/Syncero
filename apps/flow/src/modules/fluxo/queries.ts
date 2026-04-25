import { useQuery } from '@tanstack/react-query'
import { useAuthStore } from '@/store/auth'
import { getTransactions } from '@/lib/backend'

export interface DailyFlow {
  date: string
  income: number
  expense: number
  balance: number
}

export function useCashFlow(dateFrom: string, dateTo: string) {
  const activeCompany = useAuthStore((s) => s.activeCompany)

  return useQuery({
    queryKey: ['cashflow', activeCompany?.id, dateFrom, dateTo],
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

      for (const tx of result.data ?? []) {
        const existing = map.get(tx.date) ?? { income: 0, expense: 0 }
        if (tx.type === 'income') existing.income += tx.amount
        else existing.expense += tx.amount
        map.set(tx.date, existing)
      }

      let accumulated = 0
      return Array.from(map.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([date, { income, expense }]) => {
          accumulated += income - expense
          return { date, income, expense, balance: accumulated }
        })
    },
    enabled: !!activeCompany?.id && !!dateFrom && !!dateTo,
  })
}
