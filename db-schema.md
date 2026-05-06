# DB Schema — Syncero (Supabase / PostgreSQL)

> Compact reference. `?` = nullable. `NN` = NOT NULL. Enums inline.
> Source of truth: `supabase/migrations/`. Run `/sync-db-schema` to regenerate.

---

## Core

**profiles**
`id(uuid PK)`, `full_name(text NN)`, `email(text NN)`, `user_type(company_user|accountant NN)`, `avatar_url(text?)`, `created_at(ts NN)`, `updated_at(ts NN)`

**companies**
`id(uuid PK)`, `name(text NN)`, `cnpj(text?)`, `trade_name(text?)`, `tax_regime(simples|lucro_presumido|lucro_real ?)`, `owner_id(uuid FK:profiles NN)`, `is_active(bool NN)`, `segment(retail|services|manufacturing|construction|agribusiness|healthcare|education|technology|financial|other ?)`, `company_source(syncero|external NN)`, `created_at(ts NN)`, `updated_at(ts NN)`

**company_members**
`id(uuid PK)`, `company_id(uuid FK:companies NN)`, `user_id(uuid FK:profiles ?)` — null for pending, `role(admin|manager|collaborator|accountant_readonly|member|viewer NN)`, `invited_by(uuid FK:profiles ?)`, `status(pending|accepted|revoked NN)`, `email(text?)`, `invite_token(text? UNIQUE)`, `invited_at(ts NN)`, `created_at(ts NN)`

**accountant_companies**
`id(uuid PK)`, `accountant_id(uuid FK:profiles ?)` — null until accept, `company_id(uuid FK:companies NN)`, `invited_by(uuid FK:profiles ?)`, `status(pending|accepted|revoked NN)`, `email(text NN)`, `invite_token(text UNIQUE)`, `invited_at(ts NN)`, `accepted_at(ts?)`, `created_at(ts NN)`

---

## Financial (Flow)

**transactions**
`id(uuid PK)`, `company_id(uuid FK:companies ?)` — null if ext_company, `ext_company_id(uuid FK:external_companies ?)`, `category_id(uuid FK:categories ?)`, `contact_id(uuid FK:contacts ?)`, `bank_id(uuid FK:banks ?)`, `created_by(uuid FK:profiles NN)`, `type(income|expense NN)`, `amount(numeric15.2 NN)`, `description(text?)`, `date(date NN)`, `is_paid(bool NN)`, `paid_at(date?)`, `nature(sale_service|loan_received|capital_contribution|operational_expense|product_cost|asset_purchase|debt_payment|owner_withdrawal ?)`, `counterpart(text?)`, `notes(text?)`, `payment_method(cash|bank ?)`, `is_installment(bool NN)`, `installment_count(int?)`, `installment_number(int?)`, `installment_group_id(uuid?)`, `payment_registered_at(ts?)`, `payment_registered_by(uuid FK:profiles ?)`, `created_at(ts NN)`, `updated_at(ts NN)`
> company_id XOR ext_company_id — one must be set

**categories**
`id(uuid PK)`, `company_id(uuid FK:companies NN)`, `name(text NN)`, `type(income|expense NN)`, `color(text?)`, `created_at(ts NN)`

**banks**
`id(uuid PK)`, `company_id(uuid FK:companies NN)`, `name(text NN)`, `agency(text?)`, `account_number(text?)`, `account_type(checking|savings NN)`, `pix_key(text?)`, `created_at(ts NN)`

**contacts**
`id(uuid PK)`, `company_id(uuid FK:companies NN)`, `name(text NN)`, `cpf(text?)`, `cnpj(text?)`, `created_at(ts NN)`

**payables_receivables**
`id(uuid PK)`, `company_id(uuid FK:companies NN)`, `type(payable|receivable NN)`, `description(text?)`, `amount(numeric?)`, `due_date(date NN)`, `paid_date(date?)`, `status(pending|paid|overdue|cancelled NN)`, `contact_name(text?)`, `notes(text?)`, `created_by(uuid FK:profiles NN)`, `created_at(ts NN)`, `updated_at(ts NN)`

---

## Accounting (Books)

**external_companies**
`id(uuid PK)`, `accountant_id(uuid FK:profiles NN)`, `name(text NN)`, `cnpj(text?)`, `trade_name(text?)`, `tax_regime(simples|lucro_presumido|lucro_real ?)`, `integration(manual|dominio|other NN)`, `is_active(bool NN)`, `notes(text?)`, `segment(retail|… ?)`, `created_at(ts NN)`, `updated_at(ts NN)`

**account_plans**
`id(uuid PK)`, `company_id(uuid FK:companies ?)`, `ext_company_id(uuid FK:external_companies ?)`, `accountant_id(uuid FK:profiles NN)`, `parent_id(uuid FK:account_plans ?)`, `code(text NN UNIQUE/company)`, `name(text NN)`, `account_type(asset|liability|equity|revenue|expense|cost NN)`, `nature(debit|credit NN)`, `is_analytic(bool NN)`, `is_active(bool NN)`, `created_at(ts NN)`, `updated_at(ts NN)`
> company_id XOR ext_company_id

**journal_entries**
`id(uuid PK)`, `company_id(uuid FK:companies ?)`, `ext_company_id(uuid FK:external_companies ?)`, `accountant_id(uuid FK:profiles NN)`, `entry_date(date NN)`, `description(text NN)`, `source(manual|dominio_import|api|syncero_import NN)`, `external_ref(text?)`, `flow_transaction_id(uuid FK:transactions ?)`, `is_reversed(bool NN)`, `reversal_of(uuid FK:journal_entries ?)`, `created_at(ts NN)`, `updated_at(ts NN)`
> company_id XOR ext_company_id · UNIQUE on flow_transaction_id (WHERE NOT NULL)

**journal_entry_lines**
`id(uuid PK)`, `entry_id(uuid FK:journal_entries NN)`, `account_plan_id(uuid FK:account_plans NN)`, `side(debit|credit NN)`, `amount(numeric15.2 NN >0)`, `memo(text?)`, `created_at(ts NN)`

**api_keys**
`id(uuid PK)`, `accountant_id(uuid FK:profiles NN)`, `company_id(uuid FK:companies ?)`, `ext_company_id(uuid FK:external_companies ?)`, `name(text NN)`, `key_hash(text NN UNIQUE)`, `key_prefix(text NN)`, `last_used_at(ts?)`, `expires_at(ts?)`, `is_active(bool NN)`, `created_at(ts NN)`
> company_id XOR ext_company_id

---

## Fiscal (Books — read-only for accountants)

**fiscal_documents**
`id(uuid PK)`, `company_id(uuid FK:companies NN)`, `doc_type(nfe|nfse|cfe|nfce NN)`, `number(text?)`, `series(text?)`, `issue_date(date NN)`, `value(numeric?)`, `issuer_cnpj(text?)`, `issuer_name(text?)`, `recipient_cnpj(text?)`, `recipient_name(text?)`, `status(authorized|cancelled|denied|pending NN)`, `access_key(text?)`, `created_at(ts NN)`

**fiscal_books**
`id(uuid PK)`, `company_id(uuid FK:companies NN)`, `book_type(sped_fiscal|sped_contribuicoes|ecf|ecd NN)`, `reference_period(text NN)` — YYYY-MM, `status(draft|validated|transmitted NN)`, `file_url(text?)`, `transmitted_at(ts?)`, `created_at(ts NN)`

**tax_calculations**
`id(uuid PK)`, `company_id(uuid FK:companies NN)`, `reference_period(text NN)` — YYYY-MM, `tax_type(text NN)`, `base_value(numeric?)`, `rate(numeric?)`, `tax_value(numeric?)`, `status(draft|calculated|paid NN)`, `due_date(date?)`, `paid_date(date?)`, `created_at(ts NN)`

---

## Helper functions (SECURITY DEFINER)

| Function | Returns | Purpose |
|----------|---------|---------|
| `is_company_member(company_id)` | bool | authenticated user is accepted member |
| `is_company_admin(company_id)` | bool | authenticated user is accepted admin |
| `is_accountant_of(company_id)` | bool | authenticated user is accepted accountant |
