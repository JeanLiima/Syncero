import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuthStore } from '@/store/auth'
import { createTransaction, updateTransaction, deleteTransaction } from '@/lib/backend'
import type { TransactionFormData } from './types'

export function useCreateTransaction() {
  const qc = useQueryClient()
  const activeCompany = useAuthStore((s) => s.activeCompany)

  return useMutation({
    mutationFn: async (data: TransactionFormData) => {
      return createTransaction({ ...data, company_id: activeCompany!.id })
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['transactions', activeCompany?.id] }),
  })
}

export function useUpdateTransaction() {
  const qc = useQueryClient()
  const activeCompany = useAuthStore((s) => s.activeCompany)

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<TransactionFormData> }) => {
      return updateTransaction(id, data)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['transactions', activeCompany?.id] }),
  })
}

export function useMarkAsPaid() {
  const qc = useQueryClient()
  const activeCompany = useAuthStore((s) => s.activeCompany)

  return useMutation({
    mutationFn: async (id: string) => {
      await updateTransaction(id, { is_paid: true })
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['transactions', activeCompany?.id] }),
  })
}

export function useDeleteTransaction() {
  const qc = useQueryClient()
  const activeCompany = useAuthStore((s) => s.activeCompany)

  return useMutation({
    mutationFn: async (id: string) => {
      await deleteTransaction(id)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['transactions', activeCompany?.id] }),
  })
}
