// ── Shared enum union types for Flow and Books ────────────────
// Source of truth: supabase/migrations/

// ── Users & auth ──────────────────────────────────────────────
export type UserType = 'company_user' | 'accountant'

// ── Company ───────────────────────────────────────────────────
export type TaxRegime = 'simples' | 'lucro_presumido' | 'lucro_real'
export type CompanySegment =
  | 'retail' | 'services' | 'manufacturing' | 'construction'
  | 'agribusiness' | 'healthcare' | 'education' | 'technology'
  | 'financial' | 'other'

// ── Membership (company_role + invite_status enums in DB) ─────
export type MemberRole =
  | 'admin' | 'member' | 'viewer'
  | 'manager' | 'collaborator' | 'accountant_readonly'
export type MemberStatus = 'pending' | 'accepted' | 'revoked'
export type AccountantStatus = 'pending' | 'accepted' | 'revoked'

// ── Transactions ──────────────────────────────────────────────
export type TransactionType = 'income' | 'expense'
export type TransactionNature =
  | 'sale_service'
  | 'loan_received'
  | 'capital_contribution'
  | 'operational_expense'
  | 'product_cost'
  | 'asset_purchase'
  | 'debt_payment'
  | 'owner_withdrawal'
export type PaymentMethod = 'cash' | 'bank'
export type RecurrenceFrequency =
  | 'weekly' | 'biweekly' | 'monthly' | 'bimonthly'
  | 'quarterly' | 'semiannual' | 'annual'

// ── Banks ─────────────────────────────────────────────────────
export type BankAccountType = 'checking' | 'savings'

// ── Taxes ─────────────────────────────────────────────────────
export type TaxType = 'IRPJ' | 'CSLL' | 'PIS' | 'COFINS' | 'ISS' | 'ICMS'

// ── Fiscal documents ──────────────────────────────────────────
// 'cte' is used by Books (carrier e-invoice); Flow only uses the others
export type FiscalDocType = 'nfe' | 'nfse' | 'cfe' | 'nfce' | 'cte'
export type FiscalDocStatus = 'authorized' | 'cancelled' | 'denied' | 'pending'
export type FiscalBookType = 'sped_fiscal' | 'sped_contribuicoes' | 'ecf' | 'ecd'
export type FiscalBookStatus = 'draft' | 'validated' | 'transmitted'

// ── Accounting (used by Books; generic enough to share) ───────
export type EntrySource = 'manual' | 'api' | 'syncero_import'
export type AccountType = 'asset' | 'liability' | 'equity' | 'revenue' | 'expense' | 'cost'
export type AccountNature = 'debit' | 'credit'
export type JournalSide = 'debit' | 'credit'

// ── SEFAZ ─────────────────────────────────────────────────────
export interface SefazCredential {
  id: string
  environment: 'production' | 'homologation'
  uf_code: string
  is_active: boolean
  last_nsu: string
  last_sync_at: string | null
  last_error: string | null
  created_at: string
  updated_at: string
}
