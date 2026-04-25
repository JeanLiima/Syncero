import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuthStore } from '@/store/auth'
import { createPayable, updatePayable, deletePayable } from '@/lib/backend'
import type { PayableType } from '@/types'

export interface PayableFormData {
  description: string
  amount: number
  type: PayableType
  due_date: string
  contact_name?: string
  notes?: string
}

export function useCreatePayable() {
  const qc = useQueryClient()
  const activeCompany = useAuthStore((s) => s.activeCompany)

  return useMutation({
    mutationFn: async (data: PayableFormData) => {
      return createPayable({ ...data, company_id: activeCompany!.id, status: 'pending' })
    },
    onSuccess: (_, vars) =>
      qc.invalidateQueries({ queryKey: ['payables', activeCompany?.id, vars.type] }),
  })
}

export function useMarkPayablePaid() {
  const qc = useQueryClient()
  const activeCompany = useAuthStore((s) => s.activeCompany)

  return useMutation({
    mutationFn: async ({ id, type }: { id: string; type: PayableType }) => {
      await updatePayable(id, { status: 'paid', paid_date: new Date().toISOString().split('T')[0] })
      return type
    },
    onSuccess: (type) =>
      qc.invalidateQueries({ queryKey: ['payables', activeCompany?.id, type] }),
  })
}

export function useDeletePayable() {
  const qc = useQueryClient()
  const activeCompany = useAuthStore((s) => s.activeCompany)

  return useMutation({
    mutationFn: async ({ id, type }: { id: string; type: PayableType }) => {
      await deletePayable(id)
      return type
    },
    onSuccess: (type) =>
      qc.invalidateQueries({ queryKey: ['payables', activeCompany?.id, type] }),
  })
}
