import { useQuery } from '@tanstack/react-query'
import { useAuthStore } from '@/store/auth'
import { getTransactions } from '@/lib/backend'
import { startOfMonth, endOfMonth, format } from 'date-fns'

export interface DRERow {
  category_id: string | null
  category_name: string
  type: 'income' | 'expense'
  total: number
}

export function useDRE(year: number, month: number) {
  const activeCompany = useAuthStore((s) => s.activeCompany)
  const ref = new Date(year, month - 1, 1)
  const dateFrom = format(startOfMonth(ref), 'yyyy-MM-dd')
  const dateTo = format(endOfMonth(ref), 'yyyy-MM-dd')

  return useQuery({
    queryKey: ['dre', activeCompany?.id, year, month],
    queryFn: async (): Promise<DRERow[]> => {
      if (!activeCompany?.id) return []

      const result = await getTransactions({
        companyId: activeCompany.id,
        date_from: dateFrom,
        date_to: dateTo,
        page: '1',
        pageSize: '1000',
      })

      const map = new Map<string, DRERow>()

      for (const t of result.data ?? []) {
        const cat = t.categories as unknown as { id: string; name: string } | null
        const key = cat?.id ?? `__no_cat_${t.type}`
        if (!map.has(key)) {
          map.set(key, {
            category_id: cat?.id ?? null,
            category_name: cat?.name ?? 'Sem categoria',
            type: t.type as 'income' | 'expense',
            total: 0,
          })
        }
        map.get(key)!.total += t.amount
      }

      return Array.from(map.values()).sort((a, b) =>
        a.type === b.type ? a.category_name.localeCompare(b.category_name) : a.type === 'income' ? -1 : 1
      )
    },
    enabled: !!activeCompany?.id,
  })
}
