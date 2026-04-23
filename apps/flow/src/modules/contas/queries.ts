import { useQuery } from '@tanstack/react-query'
import { useAuthStore } from '@/store/auth'
import { getPayables } from '@/lib/backend'
import type { PayableReceivable, PayableType } from '@/types'

export function usePayables(type: PayableType) {
  const activeCompany = useAuthStore((s) => s.activeCompany)

  return useQuery({
    queryKey: ['payables', activeCompany?.id, type],
    queryFn: async (): Promise<PayableReceivable[]> => {
      if (!activeCompany?.id) return []
      return getPayables(activeCompany.id, type)
    },
    enabled: !!activeCompany?.id,
  })
}
