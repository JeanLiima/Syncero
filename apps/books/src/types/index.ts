// ── Enums ────────────────────────────────────────────────────

export type UserType = 'company_user' | 'accountant'
export type TransactionType = 'income' | 'expense'
export type TransactionNature =
  | 'sale_service'
  | 'loan_received'
  | 'capital_contribution'
  | 'operational_expense'
  | 'asset_purchase'
  | 'debt_payment'
  | 'owner_withdrawal'
export type PaymentMethod = 'cash' | 'bank'
export type TaxRegime = 'simples' | 'lucro_presumido' | 'lucro_real'
export type MemberRole = 'admin' | 'member' | 'viewer'
export type MemberStatus = 'active' | 'invited' | 'inactive'
export type AccountantStatus = 'pending' | 'accepted' | 'rejected'
export type PayableStatus = 'pending' | 'paid' | 'overdue' | 'cancelled'
export type PayableType = 'payable' | 'receivable'
export type FiscalDocType = 'nfe' | 'nfse' | 'cfe' | 'nfce'
export type FiscalDocStatus = 'authorized' | 'cancelled' | 'denied' | 'pending'
export type FiscalBookType = 'sped_fiscal' | 'sped_contribuicoes' | 'ecf' | 'ecd'
export type FiscalBookStatus = 'draft' | 'validated' | 'transmitted'

// ── Core entities ─────────────────────────────────────────────

export interface Profile {
  id: string
  full_name: string
  email: string
  user_type: UserType
  avatar_url: string | null
  created_at: string
  updated_at: string
}

export interface Company {
  id: string
  name: string
  cnpj: string | null
  tax_regime: TaxRegime | null
  owner_id: string
  created_at: string
  updated_at: string
}

export interface CompanyMember {
  id: string
  company_id: string
  user_id: string | null
  email: string
  role: MemberRole
  status: MemberStatus
  invite_token: string | null
  invited_at: string
  joined_at: string | null
}

export interface AccountantCompany {
  id: string
  company_id: string
  accountant_id: string | null
  email: string
  status: AccountantStatus
  invite_token: string | null
  invited_at: string
  accepted_at: string | null
  companies?: Pick<Company, 'id' | 'name'>
  profiles?: Pick<Profile, 'id' | 'full_name' | 'email' | 'avatar_url'>
}

// ── Financial ─────────────────────────────────────────────────

export interface Contact {
  id: string
  company_id: string
  name: string
  cpf: string | null
  cnpj: string | null
  created_at: string
}

export interface Bank {
  id: string
  company_id: string
  name: string
  account_type: string
  created_at: string
}

export interface Category {
  id: string
  company_id: string
  name: string
  type: TransactionType
  color: string | null
  created_at: string
}

export interface Transaction {
  id: string
  company_id: string
  category_id: string | null
  contact_id: string | null
  description: string
  amount: number
  type: TransactionType
  date: string
  is_paid: boolean
  notes: string | null
  counterpart: string | null
  paid_at: string | null
  payment_method: PaymentMethod | null
  bank_id: string | null
  payment_registered_at: string | null
  payment_registered_by: string | null
  nature: TransactionNature | null
  is_installment: boolean
  installment_count: number | null
  installment_number: number | null
  installment_group_id: string | null
  created_by: string
  created_at: string
  updated_at: string
  categories?: Pick<Category, 'id' | 'name' | 'color'>
  banks?: Pick<Bank, 'id' | 'name'>
  contacts?: Pick<Contact, 'id' | 'name' | 'cpf' | 'cnpj'>
}

export interface TransactionDetail extends Transaction {
  creator_name: string | null
  payment_registrar_name: string | null
}

export interface PayableReceivable {
  id: string
  company_id: string
  description: string
  amount: number
  type: PayableType
  due_date: string
  paid_date: string | null
  status: PayableStatus
  contact_name: string | null
  notes: string | null
  created_by: string
  created_at: string
  updated_at: string
}

// ── Fiscal ────────────────────────────────────────────────────

export interface FiscalDocument {
  id: string
  company_id: string
  doc_type: FiscalDocType
  number: string
  series: string | null
  issue_date: string
  value: number
  issuer_cnpj: string | null
  issuer_name: string | null
  recipient_cnpj: string | null
  recipient_name: string | null
  status: FiscalDocStatus
  xml_url: string | null
  access_key: string | null
  created_at: string
}

export interface FiscalBook {
  id: string
  company_id: string
  book_type: FiscalBookType
  reference_period: string
  status: FiscalBookStatus
  file_url: string | null
  transmitted_at: string | null
  created_at: string
  updated_at: string
}

export interface TaxCalculation {
  id: string
  company_id: string
  reference_period: string
  tax_type: string
  base_value: number
  rate: number
  tax_value: number
  status: 'draft' | 'calculated' | 'paid'
  due_date: string | null
  paid_date: string | null
  created_at: string
  updated_at: string
}

// ── External companies & accounting ──────────────────────────

export type EntrySource = 'manual' | 'api' | 'syncero_import'
export type AccountType = 'ativo' | 'passivo' | 'patrimonio_liquido' | 'receita' | 'despesa' | 'custo'
export type AccountNature = 'devedora' | 'credora'
export type JournalSide = 'debit' | 'credit'

export type CompanySegment =
  | 'comercio' | 'servicos' | 'industria' | 'construcao_civil'
  | 'agronegocio' | 'saude' | 'educacao' | 'tecnologia'
  | 'financeiro' | 'outros'

export interface ExternalCompany {
  id: string
  accountant_id: string
  name: string
  cnpj: string | null
  trade_name: string | null
  tax_regime: TaxRegime | null
  integration: string
  segment: CompanySegment | null
  is_active: boolean
  notes: string | null
  created_at: string
  updated_at: string
}

export interface AccountPlan {
  id: string
  company_id: string | null
  ext_company_id: string | null
  accountant_id: string
  parent_id: string | null
  code: string
  name: string
  account_type: AccountType
  nature: AccountNature
  is_analytic: boolean
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface JournalEntry {
  id: string
  company_id: string | null
  ext_company_id: string | null
  accountant_id: string
  entry_date: string
  description: string
  source: EntrySource
  external_ref: string | null
  is_reversed: boolean
  reversal_of: string | null
  created_at: string
  updated_at: string
  lines?: JournalEntryLine[]
}

export interface JournalEntryLine {
  id: string
  entry_id: string
  account_plan_id: string
  side: JournalSide
  amount: number
  memo: string | null
  created_at: string
  account_plan?: Pick<AccountPlan, 'code' | 'name'>
}

export interface ApiKey {
  id: string
  accountant_id: string
  company_id: string | null
  ext_company_id: string | null
  name: string
  key_prefix: string
  last_used_at: string | null
  expires_at: string | null
  is_active: boolean
  created_at: string
}
