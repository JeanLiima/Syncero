-- ============================================================
-- Migration 008: Fix accountant_companies for invite flow
-- accountant_id was NOT NULL, blocking invite creation before
-- the accountant has accepted. Adding invite columns too.
-- ============================================================

-- Make accountant_id nullable (accountant doesn't exist at invite time)
alter table public.accountant_companies
  alter column accountant_id drop not null;

-- Drop old unique constraint — doesn't work with NULL values
alter table public.accountant_companies
  drop constraint if exists accountant_companies_accountant_id_company_id_key;

-- Add invite columns
alter table public.accountant_companies
  add column if not exists invite_token text unique,
  add column if not exists email        text,
  add column if not exists invited_at   timestamptz not null default now();

-- One pending invite per email+company (prevents duplicate invites)
create unique index if not exists accountant_companies_pending_email_idx
  on public.accountant_companies (company_id, email)
  where status = 'pending';

-- One accepted accountant per company (preserves original business rule)
create unique index if not exists accountant_companies_accepted_idx
  on public.accountant_companies (company_id, accountant_id)
  where status = 'accepted' and accountant_id is not null;
