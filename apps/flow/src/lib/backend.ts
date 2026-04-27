import { apiFetch } from './api'
import type { Company, CompanyMember, AccountantCompany, Transaction, TransactionDetail, Category, PayableReceivable, Bank, Contact } from '@/types'

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

export async function inviteCompanyMember(companyId: string, email: string, role: string, invite_token: string, language?: 'pt' | 'en') {
  return apiFetch(`/api/company-members`, {
    method: 'POST',
    body: JSON.stringify({ companyId, email, role, invite_token, language }),
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

export async function inviteAccountant(companyId: string, email: string, invite_token: string, language: 'pt' | 'en' = 'pt') {
  return apiFetch(`/api/accountant-companies`, {
    method: 'POST',
    body: JSON.stringify({ companyId, email, invite_token, language }),
  })
}

export async function resendAccountantInvite(id: string) {
  return apiFetch(`/api/accountant-companies/${id}/resend`, { method: 'POST', body: '{}' })
}

export async function cancelAccountantInvite(id: string) {
  return apiFetch(`/api/accountant-companies/${id}`, { method: 'DELETE' })
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

export async function getContacts(companyId: string, search?: string) {
  return apiFetch<Contact[]>(`/api/contacts${buildQuery({ companyId, search })}`)
}

export async function createContact(data: { company_id: string; name: string; cpf?: string; cnpj?: string }) {
  return apiFetch<Contact>('/api/contacts', { method: 'POST', body: JSON.stringify(data) })
}

export async function updateContact(id: string, data: { name?: string; cpf?: string | null; cnpj?: string | null }) {
  return apiFetch<Contact>(`/api/contacts/${id}`, { method: 'PATCH', body: JSON.stringify(data) })
}

export async function deleteContact(id: string) {
  return apiFetch<{ ok: true }>(`/api/contacts/${id}`, { method: 'DELETE' })
}

export async function deleteTransaction(id: string) {
  return apiFetch<{ ok: true }>(`/api/transactions/${id}`, { method: 'DELETE' })
}

export async function getCategories(companyId: string) {
  return apiFetch<Category[]>(`/api/categories${buildQuery({ companyId })}`)
}

export async function getCategoryUsage(categoryId: string) {
  return apiFetch<{ count: number }>(`/api/categories/${categoryId}/usage`)
}

export async function createCategory(data: { company_id: string; name: string; type: string; color: string | null }) {
  return apiFetch<Category>('/api/categories', {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export async function updateCategory(id: string, data: Partial<Pick<Category, 'name' | 'type' | 'color'>>) {
  return apiFetch<Category>(`/api/categories/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  })
}

export async function deleteCategory(id: string, transferTo?: string | null) {
  return apiFetch<{ ok: true } | { error: string; count: number }>(
    `/api/categories/${id}`,
    { method: 'DELETE', body: JSON.stringify(transferTo !== undefined ? { transferTo } : {}) },
  )
}

export async function getBanks(companyId: string) {
  return apiFetch<Bank[]>(`/api/banks${buildQuery({ companyId })}`)
}

export async function createBank(data: { company_id: string; name: string; agency?: string; account_number?: string; account_type?: string; pix_key?: string }) {
  return apiFetch<Bank>('/api/banks', { method: 'POST', body: JSON.stringify(data) })
}

export async function updateBank(id: string, data: Partial<Pick<Bank, 'name' | 'agency' | 'account_number' | 'account_type' | 'pix_key'>>) {
  return apiFetch<Bank>(`/api/banks/${id}`, { method: 'PATCH', body: JSON.stringify(data) })
}

export async function deleteBank(id: string) {
  return apiFetch<{ ok: true }>(`/api/banks/${id}`, { method: 'DELETE' })
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
