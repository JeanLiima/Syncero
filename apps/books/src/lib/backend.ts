import { apiFetch } from './api'
import type { AccountPlan, Category, CompanySegment, FiscalBook, FiscalDocument, TaxCalculation, Transaction, TransactionDetail } from '@/types'

function toSnake(key: string): string {
  return key.replace(/([A-Z])/g, '_$1').toLowerCase()
}

function buildQuery(params: Record<string, string | undefined>) {
  const query = new URLSearchParams()
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== '') query.set(toSnake(key), value)
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

export async function getTaxCalculations(params: { companyId?: string; extCompanyId?: string }) {
  return apiFetch<TaxCalculation[]>(`/api/tax-calculations${buildQuery(params)}`)
}

export async function calculateTaxes(params: {
  companyId?: string; extCompanyId?: string
  period: string; revenue12m?: number
}) {
  const { companyId, extCompanyId, period, revenue12m } = params
  return apiFetch<TaxCalculation[]>('/api/tax-calculations/calculate', {
    method: 'POST',
    body: JSON.stringify({
      ...(companyId ? { company_id: companyId } : { ext_company_id: extCompanyId }),
      period, revenue_12m: revenue12m,
    }),
  })
}

export async function updateTaxStatus(id: string, status: TaxCalculation['status'], paidDate?: string) {
  return apiFetch<TaxCalculation>(`/api/tax-calculations/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ status, paid_date: paidDate ?? null }),
  })
}

export async function getCompanyTaxSettings(companyId: string) {
  return apiFetch<{ iss_rate: number | null; segment: CompanySegment | null }>(`/api/companies/${companyId}/tax-settings`)
}

export async function saveCompanyTaxSettings(companyId: string, data: { issRate?: number | null; segment?: CompanySegment | null }) {
  return apiFetch<{ iss_rate: number | null; segment: CompanySegment | null }>(`/api/companies/${companyId}/tax-settings`, {
    method: 'PATCH',
    body: JSON.stringify({ iss_rate: data.issRate, segment: data.segment }),
  })
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
  company_id?: string
  ext_company_id?: string
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
  company_id?: string
  ext_company_id?: string
  accounts?: PlanEntry[]
}) {
  return apiFetch<{ seeded: number }>('/api/account-plans/seed', { method: 'POST', body: JSON.stringify(body) })
}

export async function createJournalEntry(body: {
  company_id?: string
  ext_company_id?: string
  entry_date: string
  description: string
  flow_transaction_id: string
  lines: Array<{ account_plan_id: string; side: 'debit' | 'credit'; amount: number; memo?: string }>
}) {
  return apiFetch<{ id: string }>('/api/journal-entries', { method: 'POST', body: JSON.stringify(body) })
}

export type ExtTransactionBody = {
  ext_company_id: string
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
  return apiFetch<string[]>(`/api/transactions/counterparts${buildQuery({ extCompanyId })}`)
}

