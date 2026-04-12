import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/auth'
import type { Transaction } from '@/types'
import type { TransactionFilters } from './types'

export function useTransactions(filters: TransactionFilters = {}, page = 1, pageSize = 20) {
  const activeCompany = useAuthStore((s) => s.activeCompany)

  return useQuery({
    queryKey: ['transactions', activeCompany?.id, filters, page],
    queryFn: async () => {
      if (!activeCompany?.id) return { data: [] as Transaction[], count: 0 }

      let query = supabase
        .from('transactions')
        .select('*, categories(id, name, color)', { count: 'exact' })
        .eq('company_id', activeCompany.id)
        .order('date', { ascending: false })
        .range((page - 1) * pageSize, page * pageSize - 1)

      if (filters.type)        query = query.eq('type', filters.type)
      if (filters.is_paid !== undefined) query = query.eq('is_paid', filters.is_paid)
      if (filters.category_id) query = query.eq('category_id', filters.category_id)
      if (filters.date_from)   query = query.gte('date', filters.date_from)
      if (filters.date_to)     query = query.lte('date', filters.date_to)

      const { data, error, count } = await query
      if (error) throw error
      return { data: (data ?? []) as Transaction[], count: count ?? 0 }
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
      const { data, error } = await supabase
        .from('categories')
        .select('*')
        .eq('company_id', activeCompany.id)
        .order('name')
      if (error) throw error
      return data ?? []
    },
    enabled: !!activeCompany?.id,
  })
}
