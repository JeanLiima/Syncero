import { useParams } from 'react-router-dom'

export interface CompanyContext {
  id: string
  isExternal: boolean
  canWrite: boolean
  companyId: string | undefined
  extCompanyId: string | undefined
}

// Normalizes company access for pages that serve both
// /accountant/company/:companyId and /accountant/external/:extCompanyId routes.
// canWrite is true only for external companies (accountant owns them).
// Syncero Flow companies are always read-only for accountants.
export function useCompanyContext(): CompanyContext {
  const { companyId, extCompanyId } = useParams<{
    companyId?: string
    extCompanyId?: string
  }>()
  const isExternal = !!extCompanyId
  const id = extCompanyId ?? companyId ?? ''
  const canWrite = isExternal
  return { id, isExternal, canWrite, companyId, extCompanyId }
}
