-- ============================================================
-- Migration 010: Banks table + extended transaction fields
-- ============================================================

-- ── Banks ─────────────────────────────────────────────────────
create table public.banks (
  id             uuid primary key default gen_random_uuid(),
  company_id     uuid not null references public.companies(id) on delete cascade,
  name           text not null,
  agency         text,
  account_number text,
  account_type   text not null default 'checking'
                   check (account_type in ('checking', 'savings')),
  pix_key        text,
  created_at     timestamptz not null default now()
);

alter table public.banks enable row level security;

create policy "banks_member_all" on public.banks
  using  (is_company_member(company_id))
  with check (is_company_member(company_id));

-- ── Extended transaction fields ───────────────────────────────
alter table public.transactions
  add column if not exists paid_at              date,
  add column if not exists payment_method       text
    check (payment_method in ('cash', 'bank')),
  add column if not exists bank_id              uuid
    references public.banks(id) on delete set null,
  add column if not exists counterpart          text,
  add column if not exists is_installment       boolean not null default false,
  add column if not exists installment_count    integer
    check (installment_count is null or installment_count >= 2),
  add column if not exists installment_number   integer
    check (installment_number is null or installment_number >= 1),
  add column if not exists installment_group_id uuid;
