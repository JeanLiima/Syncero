import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/auth'
import type { PayableReceivable, PayableType } from '@/types'

export function usePayables(type: PayableType) {
  const activeCompany = useAuthStore((s) => s.activeCompany)

  return useQuery({
    queryKey: ['payables', activeCompany?.id, type],
    queryFn: async (): Promise<PayableReceivable[]> => {
      if (!activeCompany?.id) return []
      const { data, error } = await supabase
        .from('payables_receivables')
        .select('*')
        .eq('company_id', activeCompany.id)
        .eq('type', type)
        .order('due_date')
      if (error) throw error
      return data ?? []
    },
    enabled: !!activeCompany?.id,
  })
}
