import { apiFetch } from './api'
import type { AccountPlan, Category, FiscalBook, FiscalDocument, TaxCalculation, Transaction, TransactionDetail } from '@/types'

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
  companyId?: string
  extCompanyId?: string
  type?: string
  category_id?: string
  is_paid?: string
  date_from?: string
  date_to?: string
  search?: string
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

export async function getAccountPlans(params: { companyId?: string; extCompanyId?: string }) {
  return apiFetch<AccountPlan[]>(`/api/account-plans${buildQuery(params)}`)
}

export async function createAccountPlan(body: {
  companyId: string
  code: string
  name: string
  account_type: string
  nature: string
  is_analytic: boolean
  parent_id: string | null
}) {
  return apiFetch<AccountPlan>('/api/account-plans', { method: 'POST', body: JSON.stringify(body) })
}

export interface PlanEntry {
  code: string
  name: string
  account_type: string
  nature: string
  is_analytic: boolean
  parent_code: string | null
}

export async function seedAccountPlan(body: {
  companyId?: string
  extCompanyId?: string
  accounts?: PlanEntry[]
}) {
  return apiFetch<{ seeded: number }>('/api/account-plans/seed', { method: 'POST', body: JSON.stringify(body) })
}

export async function createJournalEntry(body: {
  companyId?: string
  extCompanyId?: string
  entry_date: string
  description: string
  flow_transaction_id: string
  lines: Array<{ account_plan_id: string; side: 'debit' | 'credit'; amount: number; memo?: string }>
}) {
  return apiFetch<{ id: string }>('/api/journal-entries', { method: 'POST', body: JSON.stringify(body) })
}

export type ExtTransactionBody = {
  extCompanyId: string
  description: string
  amount: number
  type: 'income' | 'expense'
  date: string
  is_paid: boolean
  paid_at?: string | null
  nature?: string | null
  counterpart?: string | null
  notes?: string | null
}

export async function createExtTransaction(body: ExtTransactionBody) {
  return apiFetch<Transaction>('/api/transactions', { method: 'POST', body: JSON.stringify(body) })
}

export async function updateExtTransaction(id: string, body: Partial<Omit<ExtTransactionBody, 'extCompanyId'>>) {
  return apiFetch<Transaction>(`/api/transactions/${id}`, { method: 'PATCH', body: JSON.stringify(body) })
}

export async function deleteExtTransaction(id: string) {
  return apiFetch<{ ok: true }>(`/api/transactions/${id}`, { method: 'DELETE' })
}

export async function getExtCounterparts(extCompanyId: string): Promise<string[]> {
  return apiFetch<string[]>(`/api/transactions/counterparts?extCompanyId=${extCompanyId}`)
}

