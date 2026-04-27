-- Rename due_date → date (competency date)
alter table public.transactions rename column due_date to date;

-- Drop old paid_date (superseded by paid_at added in migration 010)
alter table public.transactions drop column if exists paid_date;

-- Drop unused recurrence column
alter table public.transactions drop column if exists recurrence;

-- Update index that referenced due_date
drop index if exists public.transactions_company_id_due_date_idx;
create index transactions_company_id_date_idx on public.transactions(company_id, date);
