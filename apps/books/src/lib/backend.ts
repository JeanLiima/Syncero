import { apiFetch } from './api'
import type { Category, FiscalBook, FiscalDocument, TaxCalculation, Transaction, TransactionDetail } from '@/types'

function buildQuery(params: Record<string, string | undefined>) {
  const query = new URLSearchParams()
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== '') query.set(key, value)
  })
  const queryString = query.toString()
  return queryString ? `?${queryString}` : ''
}

export async function getFiscalBooks(companyId: string) {
  return apiFetch<FiscalBook[]>(`/api/fiscal-books${buildQuery({ companyId })}`)
}

export async function getFiscalDocuments(companyId: string, opts: { doc_type?: string; date_from?: string; date_to?: string } = {}) {
  return apiFetch<FiscalDocument[]>(`/api/fiscal-documents${buildQuery({ companyId, ...opts })}`)
}

export async function getTaxCalculations(companyId: string) {
  return apiFetch<TaxCalculation[]>(`/api/tax-calculations${buildQuery({ companyId })}`)
}

export type TransactionQueryParams = {
  companyId: string
  type?: string
  category_id?: string
  is_paid?: string
  date_from?: string
  date_to?: string
  page?: string
  pageSize?: string
} & Record<string, string | undefined>

export async function getTransactions(params: TransactionQueryParams) {
  return apiFetch<{ data: Transaction[]; count: number }>(`/api/transactions${buildQuery(params)}`)
}

export async function getTransactionDetail(id: string) {
  return apiFetch<TransactionDetail>(`/api/transactions/${id}`)
}

export async function getCategories(companyId: string) {
  return apiFetch<Category[]>(`/api/categories${buildQuery({ companyId })}`)
}
