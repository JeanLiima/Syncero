import type { TransactionType } from '@/types'

export interface TransactionFilters {
  type?: TransactionType
  is_paid?: boolean
  category_id?: string
  date_from?: string
  date_to?: string
  search?: string
}

export interface TransactionFormData {
  description: string
  amount: number
  type: TransactionType
  date: string
  category_id?: string | null
  contact_id?: string | null
  counterpart?: string | null
  notes?: string | null
  is_paid: boolean
  paid_at?: string | null
  payment_method?: 'cash' | 'bank' | null
  bank_id?: string | null
  payment_registered_at?: string | null
  payment_registered_by?: string | null
  is_installment?: boolean
  installment_count?: number | null
  installment_number?: number | null
  installment_group_id?: string | null
}
