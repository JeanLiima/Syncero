-- ============================================================
-- FINFLOW — Schema inicial
-- Multi-tenant + Contador com acesso fiscal (leitura)
-- ============================================================

-- ── Extensões ───────────────────────────────────────────────
create extension if not exists "uuid-ossp";

-- ── Enum: tipo de usuário ────────────────────────────────────
create type user_type as enum ('company_user', 'accountant');

-- ── Enum: role dentro da empresa ────────────────────────────
create type company_role as enum ('admin', 'manager', 'collaborator', 'accountant_readonly');

-- ── Enum: status de convite ──────────────────────────────────
create type invite_status as enum ('pending', 'accepted', 'revoked');

-- ============================================================
-- TABELA: profiles
-- Extende o auth.users do Supabase
-- ============================================================
create table public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  full_name   text not null,
  email       text not null,
  user_type   user_type not null default 'company_user',
  avatar_url  text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ============================================================
-- TABELA: companies
-- Cada empresa é um tenant isolado
-- ============================================================
create table public.companies (
  id           uuid primary key default uuid_generate_v4(),
  name         text not null,
  cnpj         text unique,
  trade_name   text,
  -- regime tributário
  tax_regime   text check (tax_regime in ('simples', 'lucro_presumido', 'lucro_real')),
  owner_id     uuid not null references public.profiles(id),
  is_active    boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- ============================================================
-- TABELA: company_members
-- Usuários internos da empresa (admin, gestor, colaborador)
-- ============================================================
create table public.company_members (
  id          uuid primary key default uuid_generate_v4(),
  company_id  uuid not null references public.companies(id) on delete cascade,
  user_id     uuid not null references public.profiles(id) on delete cascade,
  role        company_role not null default 'collaborator',
  invited_by  uuid references public.profiles(id),
  status      invite_status not null default 'accepted',
  created_at  timestamptz not null default now(),
  unique (company_id, user_id)
);

-- ============================================================
-- TABELA: accountant_companies
-- Vínculo N:N entre contadores e empresas
-- Chave do acesso fiscal via RLS
-- ============================================================
create table public.accountant_companies (
  id             uuid primary key default uuid_generate_v4(),
  accountant_id  uuid not null references public.profiles(id) on delete cascade,
  company_id     uuid not null references public.companies(id) on delete cascade,
  invited_by     uuid references public.profiles(id),
  status         invite_status not null default 'pending',
  accepted_at    timestamptz,
  created_at     timestamptz not null default now(),
  unique (accountant_id, company_id)
);

-- ============================================================
-- TABELA: categories
-- Categorias de lançamento por empresa
-- ============================================================
create table public.categories (
  id          uuid primary key default uuid_generate_v4(),
  company_id  uuid not null references public.companies(id) on delete cascade,
  name        text not null,
  type        text not null check (type in ('income', 'expense')),
  color       text,
  created_at  timestamptz not null default now()
);

-- ============================================================
-- TABELA: transactions
-- Lançamentos de receitas e despesas
-- ============================================================
create table public.transactions (
  id              uuid primary key default uuid_generate_v4(),
  company_id      uuid not null references public.companies(id) on delete cascade,
  category_id     uuid references public.categories(id),
  created_by      uuid not null references public.profiles(id),
  type            text not null check (type in ('income', 'expense')),
  amount          numeric(15, 2) not null,
  description     text,
  due_date        date not null,
  paid_date       date,
  is_paid         boolean not null default false,
  recurrence      text check (recurrence in ('none','daily','weekly','monthly','yearly')) default 'none',
  notes           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- ============================================================
-- TABELA: payables_receivables
-- Contas a pagar e a receber com parcelas
-- ============================================================
create table public.payables_receivables (
  id              uuid primary key default uuid_generate_v4(),
  company_id      uuid not null references public.companies(id) on delete cascade,
  type            text not null check (type in ('payable', 'receivable')),
  counterpart     text not null,       -- fornecedor ou cliente
  total_amount    numeric(15, 2) not null,
  installments    int not null default 1,
  due_date        date not null,
  paid_date       date,
  is_paid         boolean not null default false,
  transaction_id  uuid references public.transactions(id),
  created_by      uuid not null references public.profiles(id),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- ============================================================
-- TABELA: fiscal_documents
-- NF-e, NFS-e e documentos fiscais (leitura pelo contador)
-- ============================================================
create table public.fiscal_documents (
  id              uuid primary key default uuid_generate_v4(),
  company_id      uuid not null references public.companies(id) on delete cascade,
  doc_type        text not null check (doc_type in ('nfe', 'nfse', 'cfe', 'cte')),
  doc_number      text,
  series          text,
  issue_date      date not null,
  amount          numeric(15, 2),
  tax_amount      numeric(15, 2),
  counterpart     text,
  xml_url         text,               -- Storage do Supabase
  integration_ref text,               -- ref no software fiscal externo
  raw_data        jsonb,              -- payload completo da integração
  created_at      timestamptz not null default now()
);

-- ============================================================
-- TABELA: fiscal_books
-- SPED e livros fiscais
-- ============================================================
create table public.fiscal_books (
  id          uuid primary key default uuid_generate_v4(),
  company_id  uuid not null references public.companies(id) on delete cascade,
  book_type   text not null check (book_type in ('sped_fiscal', 'sped_contribuicoes', 'sped_contabil')),
  period      text not null,           -- ex: '2024-04'
  file_url    text,                    -- arquivo .txt no Storage
  status      text not null default 'draft' check (status in ('draft','validated','transmitted')),
  created_at  timestamptz not null default now()
);

-- ============================================================
-- TABELA: tax_calculations
-- Apuração de impostos por período
-- ============================================================
create table public.tax_calculations (
  id              uuid primary key default uuid_generate_v4(),
  company_id      uuid not null references public.companies(id) on delete cascade,
  period          text not null,       -- ex: '2024-04'
  tax_type        text not null,       -- IRPJ, CSLL, PIS, COFINS, ISS, ICMS...
  base_amount     numeric(15, 2),
  rate            numeric(6, 4),
  tax_amount      numeric(15, 2),
  status          text not null default 'open' check (status in ('open','paid','overdue')),
  due_date        date,
  paid_date       date,
  notes           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- ============================================================
-- ÍNDICES
-- ============================================================
create index on public.transactions (company_id, due_date);
create index on public.transactions (company_id, type, is_paid);
create index on public.payables_receivables (company_id, type, is_paid);
create index on public.fiscal_documents (company_id, issue_date);
create index on public.fiscal_documents (company_id, doc_type);
create index on public.tax_calculations (company_id, period);
create index on public.accountant_companies (accountant_id) where status = 'accepted';

-- ============================================================
-- FUNÇÕES AUXILIARES
-- ============================================================

-- Retorna se o usuário atual é membro ativo de uma empresa
create or replace function public.is_company_member(p_company_id uuid)
returns boolean language sql security definer as $$
  select exists (
    select 1 from public.company_members
    where company_id = p_company_id
      and user_id = auth.uid()
      and status = 'accepted'
  );
$$;

-- Retorna se o usuário atual é contador vinculado a uma empresa
create or replace function public.is_accountant_of(p_company_id uuid)
returns boolean language sql security definer as $$
  select exists (
    select 1 from public.accountant_companies
    where company_id = p_company_id
      and accountant_id = auth.uid()
      and status = 'accepted'
  );
$$;

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

alter table public.profiles               enable row level security;
alter table public.companies              enable row level security;
alter table public.company_members        enable row level security;
alter table public.accountant_companies   enable row level security;
alter table public.categories             enable row level security;
alter table public.transactions           enable row level security;
alter table public.payables_receivables   enable row level security;
alter table public.fiscal_documents       enable row level security;
alter table public.fiscal_books           enable row level security;
alter table public.tax_calculations       enable row level security;

-- ── profiles ────────────────────────────────────────────────
create policy "Usuário vê próprio perfil"
  on public.profiles for select using (auth.uid() = id);

create policy "Usuário atualiza próprio perfil"
  on public.profiles for update using (auth.uid() = id);

-- ── companies ───────────────────────────────────────────────
create policy "Membro vê empresa"
  on public.companies for select
  using (public.is_company_member(id) or owner_id = auth.uid());

create policy "Admin cria empresa"
  on public.companies for insert
  with check (owner_id = auth.uid());

create policy "Admin atualiza empresa"
  on public.companies for update
  using (owner_id = auth.uid());

-- ── company_members ─────────────────────────────────────────
create policy "Membro vê membros da empresa"
  on public.company_members for select
  using (public.is_company_member(company_id));

create policy "Admin gerencia membros"
  on public.company_members for all
  using (
    exists (
      select 1 from public.company_members cm
      where cm.company_id = company_members.company_id
        and cm.user_id = auth.uid()
        and cm.role = 'admin'
    )
  );

-- ── accountant_companies ────────────────────────────────────
create policy "Contador vê seus vínculos"
  on public.accountant_companies for select
  using (accountant_id = auth.uid() or public.is_company_member(company_id));

create policy "Admin vincula contador"
  on public.accountant_companies for insert
  with check (
    exists (
      select 1 from public.company_members cm
      where cm.company_id = accountant_companies.company_id
        and cm.user_id = auth.uid()
        and cm.role = 'admin'
    )
  );

create policy "Contador aceita convite"
  on public.accountant_companies for update
  using (accountant_id = auth.uid());

-- ── categories ──────────────────────────────────────────────
create policy "Membro vê categorias"
  on public.categories for select
  using (public.is_company_member(company_id));

create policy "Membro cria/edita categorias"
  on public.categories for all
  using (public.is_company_member(company_id));

-- ── transactions ────────────────────────────────────────────
create policy "Membro vê lançamentos"
  on public.transactions for select
  using (public.is_company_member(company_id));

create policy "Membro cria/edita lançamentos"
  on public.transactions for all
  using (public.is_company_member(company_id));

-- ── payables_receivables ────────────────────────────────────
create policy "Membro vê contas"
  on public.payables_receivables for select
  using (public.is_company_member(company_id));

create policy "Membro cria/edita contas"
  on public.payables_receivables for all
  using (public.is_company_member(company_id));

-- ── fiscal_documents (leitura para contador) ────────────────
create policy "Membro ou contador vê documentos fiscais"
  on public.fiscal_documents for select
  using (
    public.is_company_member(company_id)
    or public.is_accountant_of(company_id)
  );

create policy "Membro cria documentos fiscais"
  on public.fiscal_documents for insert
  with check (public.is_company_member(company_id));

-- ── fiscal_books ────────────────────────────────────────────
create policy "Membro ou contador vê livros fiscais"
  on public.fiscal_books for select
  using (
    public.is_company_member(company_id)
    or public.is_accountant_of(company_id)
  );

create policy "Membro cria livros fiscais"
  on public.fiscal_books for insert
  with check (public.is_company_member(company_id));

-- ── tax_calculations ────────────────────────────────────────
create policy "Membro ou contador vê apurações"
  on public.tax_calculations for select
  using (
    public.is_company_member(company_id)
    or public.is_accountant_of(company_id)
  );

create policy "Membro cria/edita apurações"
  on public.tax_calculations for all
  using (public.is_company_member(company_id));

-- ============================================================
-- TRIGGER: updated_at automático
-- ============================================================
create or replace function public.handle_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger trg_profiles_updated_at
  before update on public.profiles
  for each row execute function public.handle_updated_at();

create trigger trg_companies_updated_at
  before update on public.companies
  for each row execute function public.handle_updated_at();

create trigger trg_transactions_updated_at
  before update on public.transactions
  for each row execute function public.handle_updated_at();

create trigger trg_payables_updated_at
  before update on public.payables_receivables
  for each row execute function public.handle_updated_at();

create trigger trg_tax_calc_updated_at
  before update on public.tax_calculations
  for each row execute function public.handle_updated_at();
