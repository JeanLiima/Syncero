import { useQuery } from '@tanstack/react-query'
import { useAuthStore } from '@/store/auth'
import { apiFetch } from '@/lib/api'

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
    queryFn: () =>
      apiFetch<DailyFlow[]>(
        `/api/cash-flow?company_id=${activeCompany!.id}&date_from=${dateFrom}&date_to=${dateTo}`
      ),
    enabled: !!activeCompany?.id && !!dateFrom && !!dateTo,
  })
}
