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
  category_id?: string
  contact_id?: string
  counterpart?: string
  notes?: string
  is_paid: boolean
  paid_at?: string
  payment_method?: 'cash' | 'bank'
  bank_id?: string
  payment_registered_at?: string
  payment_registered_by?: string
  is_installment?: boolean
  installment_count?: number
  installment_number?: number
  installment_group_id?: string
}
