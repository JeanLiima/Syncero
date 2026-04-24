import { apiFetch } from './api'
import type { Company, CompanyMember, AccountantCompany, Transaction, Category, PayableReceivable } from '@/types'

function buildQuery(params: Record<string, string | undefined>) {
  const query = new URLSearchParams()
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== '') query.set(key, value)
  })
  const queryString = query.toString()
  return queryString ? `?${queryString}` : ''
}

export async function getCompany(companyId: string) {
  return apiFetch<Company>(`/api/companies/${companyId}`)
}

export async function updateCompany(companyId: string, payload: Partial<Company>) {
  return apiFetch<Company>(`/api/companies/${companyId}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })
}

export async function getCompanyMembers(companyId: string) {
  return apiFetch<CompanyMember[]>(`/api/company-members${buildQuery({ companyId })}`)
}

export async function inviteCompanyMember(companyId: string, email: string, role: string, invite_token: string) {
  return apiFetch(`/api/company-members`, {
    method: 'POST',
    body: JSON.stringify({ companyId, email, role, invite_token }),
  })
}

export async function revokeCompanyMember(memberId: string) {
  return apiFetch(`/api/company-members/${memberId}`, {
    method: 'PATCH',
    body: JSON.stringify({ status: 'revoked' }),
  })
}

export async function getAccountantCompanies(companyId?: string) {
  return apiFetch<AccountantCompany[]>(`/api/accountant-companies${buildQuery({ companyId })}`)
}

export async function inviteAccountant(companyId: string, email: string, invite_token: string) {
  return apiFetch(`/api/accountant-companies`, {
    method: 'POST',
    body: JSON.stringify({ companyId, email, invite_token }),
  })
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

export async function createTransaction(data: Partial<Transaction>) {
  return apiFetch<Transaction>('/api/transactions', {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export async function updateTransaction(id: string, data: Partial<Transaction>) {
  return apiFetch<Transaction>(`/api/transactions/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  })
}

export async function deleteTransaction(id: string) {
  return apiFetch<{ ok: true }>(`/api/transactions/${id}`, { method: 'DELETE' })
}

export async function getCategories(companyId: string) {
  return apiFetch<Category[]>(`/api/categories${buildQuery({ companyId })}`)
}

export async function getPayables(companyId: string, type: string) {
  return apiFetch<PayableReceivable[]>(`/api/payables${buildQuery({ companyId, type })}`)
}

export async function createPayable(data: Partial<PayableReceivable>) {
  return apiFetch<PayableReceivable>('/api/payables', {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export async function updatePayable(id: string, data: Partial<PayableReceivable>) {
  return apiFetch<PayableReceivable>(`/api/payables/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  })
}

export async function deletePayable(id: string) {
  return apiFetch<{ ok: true }>(`/api/payables/${id}`, { method: 'DELETE' })
}
