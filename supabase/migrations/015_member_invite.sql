-- ============================================================
-- 015_member_invite.sql
-- Adapta company_members para suportar o fluxo de convite
-- ============================================================

-- 1. Adicionar valores ao enum company_role para alinhar com o frontend
alter type company_role add value if not exists 'member';
alter type company_role add value if not exists 'viewer';

-- 2. Tornar user_id nullable (convites pendentes não têm user ainda)
alter table public.company_members
  alter column user_id drop not null;

-- 3. Remover unique constraint antiga (não funciona com NULLs múltiplos)
alter table public.company_members
  drop constraint if exists company_members_company_id_user_id_key;

-- 4. Adicionar unique parcial: só aplica quando user_id não é null
create unique index if not exists company_members_company_user_unique
  on public.company_members (company_id, user_id)
  where user_id is not null;

-- 5. Adicionar colunas de convite
alter table public.company_members
  add column if not exists email       text,
  add column if not exists invite_token text unique,
  add column if not exists invited_at  timestamptz not null default now();

-- 6. Preencher email dos membros existentes a partir de profiles
update public.company_members cm
set email = p.email
from public.profiles p
where p.id = cm.user_id
  and cm.email is null;

-- 7. Unique parcial: um convite pendente por email por empresa
create unique index if not exists company_members_pending_email_unique
  on public.company_members (company_id, email)
  where status = 'pending';
