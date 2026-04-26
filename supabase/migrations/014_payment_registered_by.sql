alter table public.transactions
  add column payment_registered_by uuid references public.profiles(id);
