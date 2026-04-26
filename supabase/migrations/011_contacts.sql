-- Contacts table
create table contacts (
  id          uuid        primary key default gen_random_uuid(),
  company_id  uuid        not null references companies(id) on delete cascade,
  name        text        not null,
  cpf         text,
  cnpj        text,
  created_at  timestamptz not null default now()
);

create index contacts_company_id_idx on contacts(company_id);

alter table contacts enable row level security;

create policy contacts_member_all on contacts
  for all
  using (is_company_member(company_id))
  with check (is_company_member(company_id));

-- Link transactions to contacts
alter table transactions
  add column contact_id uuid references contacts(id) on delete set null;
