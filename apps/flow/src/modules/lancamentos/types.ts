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
  is_paid: boolean
  notes?: string
}
