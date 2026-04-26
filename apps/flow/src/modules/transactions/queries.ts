import { useQuery } from '@tanstack/react-query'
import { useAuthStore } from '@/store/auth'
import { getTransactions, getCategories, getBanks, getContacts } from '@/lib/backend'
import type { Transaction } from '@/types'
import type { TransactionFilters } from './types'

export function useTransactions(filters: TransactionFilters = {}, page = 1, pageSize = 20) {
  const activeCompany = useAuthStore((s) => s.activeCompany)

  return useQuery({
    queryKey: ['transactions', activeCompany?.id, filters, page],
    queryFn: async () => {
      if (!activeCompany?.id) return { data: [] as Transaction[], count: 0 }

      const result = await getTransactions({
        companyId: activeCompany.id,
        type: filters.type,
        category_id: filters.category_id,
        is_paid: filters.is_paid === undefined ? undefined : String(filters.is_paid),
        date_from: filters.date_from,
        date_to: filters.date_to,
        search: filters.search,
        page: String(page),
        pageSize: String(pageSize),
      })

      return { data: result.data ?? [], count: result.count ?? 0 }
    },
    enabled: !!activeCompany?.id,
  })
}

export function useCategories() {
  const activeCompany = useAuthStore((s) => s.activeCompany)

  return useQuery({
    queryKey: ['categories', activeCompany?.id],
    queryFn: async () => {
      if (!activeCompany?.id) return []
      return getCategories(activeCompany.id)
    },
    enabled: !!activeCompany?.id,
  })
}

export function useContacts(search: string) {
  const activeCompany = useAuthStore((s) => s.activeCompany)

  return useQuery({
    queryKey: ['contacts', activeCompany?.id, search],
    queryFn: async () => {
      if (!activeCompany?.id) return []
      return getContacts(activeCompany.id, search || undefined)
    },
    enabled: !!activeCompany?.id,
  })
}

export function useBanks() {
  const activeCompany = useAuthStore((s) => s.activeCompany)

  return useQuery({
    queryKey: ['banks', activeCompany?.id],
    queryFn: async () => {
      if (!activeCompany?.id) return []
      return getBanks(activeCompany.id)
    },
    enabled: !!activeCompany?.id,
  })
}
