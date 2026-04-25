-- ============================================================
-- Migration 009: Default categories seed on company creation
-- ============================================================

-- Function to seed default categories for a new company
create or replace function seed_default_categories(p_company_id uuid)
returns void language plpgsql as $$
begin
  insert into public.categories (company_id, name, type, color) values
    -- Income
    (p_company_id, 'Vendas',           'income',  '#10b981'),
    (p_company_id, 'Serviços',         'income',  '#3b82f6'),
    (p_company_id, 'Outras Receitas',  'income',  '#8b5cf6'),
    -- Expense
    (p_company_id, 'Fornecedores',     'expense', '#f43f5e'),
    (p_company_id, 'Folha de Pagamento','expense','#f59e0b'),
    (p_company_id, 'Aluguel',          'expense', '#ec4899'),
    (p_company_id, 'Impostos',         'expense', '#6366f1'),
    (p_company_id, 'Marketing',        'expense', '#14b8a6'),
    (p_company_id, 'Outras Despesas',  'expense', '#94a3b8');
end;
$$;

-- Trigger function
create or replace function trigger_seed_default_categories()
returns trigger language plpgsql as $$
begin
  perform seed_default_categories(new.id);
  return new;
end;
$$;

-- Attach trigger to companies table
drop trigger if exists on_company_created on public.companies;
create trigger on_company_created
  after insert on public.companies
  for each row execute function trigger_seed_default_categories();
