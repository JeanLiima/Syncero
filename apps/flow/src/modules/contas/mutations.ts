import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/auth'
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
      const { data: result, error } = await supabase
        .from('payables_receivables')
        .insert({ ...data, company_id: activeCompany!.id, status: 'pending' })
        .select()
        .single()
      if (error) throw error
      return result
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
      const { error } = await supabase
        .from('payables_receivables')
        .update({ status: 'paid', paid_date: new Date().toISOString().split('T')[0] })
        .eq('id', id)
        .eq('company_id', activeCompany!.id)
      if (error) throw error
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
      const { error } = await supabase
        .from('payables_receivables')
        .delete()
        .eq('id', id)
        .eq('company_id', activeCompany!.id)
      if (error) throw error
      return type
    },
    onSuccess: (type) =>
      qc.invalidateQueries({ queryKey: ['payables', activeCompany?.id, type] }),
  })
}
