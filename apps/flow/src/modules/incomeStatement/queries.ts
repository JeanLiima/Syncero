import { useQuery } from '@tanstack/react-query'
import { useAuthStore } from '@/store/auth'
import { apiFetch } from '@/lib/api'
import { format, startOfMonth, endOfMonth } from 'date-fns'

export interface IncomeStatementRow {
  category_id: string | null
  category_name: string
  type: 'income' | 'expense'
  total: number
}

export function useIncomeStatement(year: number, month: number) {
  const activeCompany = useAuthStore((s) => s.activeCompany)
  const ref     = new Date(year, month - 1, 1)
  const dateFrom = format(startOfMonth(ref), 'yyyy-MM-dd')
  const dateTo   = format(endOfMonth(ref),   'yyyy-MM-dd')

  return useQuery({
    queryKey: ['incomeStatement', activeCompany?.id, year, month],
    queryFn: () =>
      apiFetch<IncomeStatementRow[]>(
        `/api/income-statement?company_id=${activeCompany!.id}&date_from=${dateFrom}&date_to=${dateTo}`
      ),
    enabled: !!activeCompany?.id,
  })
}
