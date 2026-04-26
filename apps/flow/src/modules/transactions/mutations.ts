import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuthStore } from '@/store/auth'
import { createTransaction, updateTransaction, deleteTransaction } from '@/lib/backend'
import type { TransactionFormData } from './types'

function invalidateTransactionDeps(qc: ReturnType<typeof useQueryClient>, companyId: string | undefined) {
  const id = companyId
  qc.invalidateQueries({ queryKey: ['transactions', id] })
  qc.invalidateQueries({ queryKey: ['dashboard-summary', id] })
  qc.invalidateQueries({ queryKey: ['dashboard-chart', id] })
  qc.invalidateQueries({ queryKey: ['dashboard-recent', id] })
  qc.invalidateQueries({ queryKey: ['cashflow', id] })
  qc.invalidateQueries({ queryKey: ['incomeStatement', id] })
}

export function useCreateTransaction() {
  const qc = useQueryClient()
  const activeCompany = useAuthStore((s) => s.activeCompany)

  return useMutation({
    mutationFn: async (data: TransactionFormData) => {
      return createTransaction({ ...data, company_id: activeCompany!.id })
    },
    onSuccess: () => invalidateTransactionDeps(qc, activeCompany?.id),
  })
}

export function useUpdateTransaction() {
  const qc = useQueryClient()
  const activeCompany = useAuthStore((s) => s.activeCompany)

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<TransactionFormData> }) => {
      return updateTransaction(id, data)
    },
    onSuccess: (_result, { id }) => {
      invalidateTransactionDeps(qc, activeCompany?.id)
      qc.invalidateQueries({ queryKey: ['transaction', id] })
    },
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
    onSuccess: (_result, id) => {
      invalidateTransactionDeps(qc, activeCompany?.id)
      qc.invalidateQueries({ queryKey: ['transaction', id] })
    },
  })
}
