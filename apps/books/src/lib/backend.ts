import { apiFetch } from './api'
import type { FiscalBook, FiscalDocument, TaxCalculation } from '@/types'

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
