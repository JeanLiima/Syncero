-- Add recurrence_type to support recurring transactions
alter table public.transactions
  add column if not exists recurrence_type text check (
    recurrence_type in ('weekly','biweekly','monthly','bimonthly','quarterly','semiannual','annual')
  );
