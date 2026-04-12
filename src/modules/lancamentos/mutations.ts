import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/auth'
import type { TransactionFormData } from './types'

export function useCreateTransaction() {
  const qc = useQueryClient()
  const activeCompany = useAuthStore((s) => s.activeCompany)

  return useMutation({
    mutationFn: async (data: TransactionFormData) => {
      const { data: result, error } = await supabase
        .from('transactions')
        .insert({ ...data, company_id: activeCompany!.id })
        .select()
        .single()
      if (error) throw error
      return result
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['transactions', activeCompany?.id] }),
  })
}

export function useUpdateTransaction() {
  const qc = useQueryClient()
  const activeCompany = useAuthStore((s) => s.activeCompany)

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<TransactionFormData> }) => {
      const { data: result, error } = await supabase
        .from('transactions')
        .update(data)
        .eq('id', id)
        .eq('company_id', activeCompany!.id)
        .select()
        .single()
      if (error) throw error
      return result
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['transactions', activeCompany?.id] }),
  })
}

export function useMarkAsPaid() {
  const qc = useQueryClient()
  const activeCompany = useAuthStore((s) => s.activeCompany)

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('transactions')
        .update({ is_paid: true })
        .eq('id', id)
        .eq('company_id', activeCompany!.id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['transactions', activeCompany?.id] }),
  })
}

export function useDeleteTransaction() {
  const qc = useQueryClient()
  const activeCompany = useAuthStore((s) => s.activeCompany)

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('transactions')
        .delete()
        .eq('id', id)
        .eq('company_id', activeCompany!.id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['transactions', activeCompany?.id] }),
  })
}
