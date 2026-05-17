// ── Shared enum types (single source of truth) ───────────────
export type {
  UserType,
  TaxRegime,
  CompanySegment,
  MemberRole,
  MemberStatus,
  AccountantStatus,
  TransactionType,
  TransactionNature,
  PaymentMethod,
  RecurrenceFrequency,
  BankAccountType,
  TaxType,
  FiscalDocType,
  FiscalDocStatus,
  FiscalBookType,
  FiscalBookStatus,
  EntrySource,
  AccountType,
  AccountNature,
  JournalSide,
} from '@syncero/types'

// ── Flow-specific interfaces ──────────────────────────────────

import type {
  UserType, TaxRegime, CompanySegment, MemberRole, MemberStatus,
  AccountantStatus, TransactionType, TransactionNature, PaymentMethod,
  BankAccountType, TaxType, FiscalDocType, FiscalDocStatus,
  FiscalBookType, FiscalBookStatus,
} from '@syncero/types'

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
  trade_name: string | null
  tax_regime: TaxRegime | null
  segment: CompanySegment | null
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
  profiles?: {
    id: string
    full_name: string
    email: string
    avatar_url: string | null
  } | null
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
  agency: string | null
  account_number: string | null
  account_type: BankAccountType
  pix_key: string | null
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
  tax_type: TaxType
  base_value: number
  rate: number
  tax_value: number
  status: 'draft' | 'calculated' | 'paid'
  due_date: string | null
  paid_date: string | null
  created_at: string
  updated_at: string
}
