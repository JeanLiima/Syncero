-- ============================================================
-- MIGRATION 002 — Corrige recursão infinita nas policies de
-- company_members e profiles (upsert no onboarding)
-- ============================================================
--
-- PROBLEMA:
--   A policy "Admin gerencia membros" em company_members usa uma
--   subquery direta na própria tabela:
--
--     exists (select 1 from public.company_members cm where ...)
--
--   Quando o PostgreSQL avalia essa policy ela dispara o RLS da
--   tabela company_members novamente → chama a mesma policy →
--   loop infinito.
--
-- SOLUÇÃO:
--   Criar a função is_company_admin() com SECURITY DEFINER
--   (executa como owner do DB, sem RLS) e usá-la na policy.
--   Mesmo padrão já aplicado em is_company_member().
--
-- EFEITO COLATERAL CORRIGIDO:
--   Após criar perfil (onboarding), fetchProfile tenta inserir
--   em company_members como admin. O erro 500 bloqueava esse
--   fluxo. Com a policy corrigida isso funciona normalmente.
-- ============================================================

-- ── 1. Função auxiliar: verifica se o usuário é admin da empresa
create or replace function public.is_company_admin(p_company_id uuid)
returns boolean language sql security definer stable as $$
  select exists (
    select 1 from public.company_members
    where company_id  = p_company_id
      and user_id     = auth.uid()
      and role        = 'admin'
      and status      = 'accepted'
  );
$$;

-- ── 2. Recria a policy problemática usando a função SECURITY DEFINER
drop policy if exists "Admin gerencia membros" on public.company_members;

create policy "Admin gerencia membros"
  on public.company_members for all
  using     (public.is_company_admin(company_id))
  with check(public.is_company_admin(company_id));

-- ── 3. Garante que o dono da empresa pode inserir a si mesmo como admin
--      (necessário no fluxo de criação de empresa em NoCompanyShell)
drop policy if exists "Owner insere si mesmo como admin" on public.company_members;

create policy "Owner insere si mesmo como admin"
  on public.company_members for insert
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.companies
      where id = company_id
        and owner_id = auth.uid()
    )
  );

-- ── 4. Permite upsert de perfil próprio (necessário no onboarding)
drop policy if exists "Usuário cria próprio perfil" on public.profiles;

create policy "Usuário cria próprio perfil"
  on public.profiles for insert
  with check (auth.uid() = id);
