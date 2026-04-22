-- Migration 004: Chart of accounts (Plano de Contas)
-- Hierarchical accounting chart per company. Supports both Syncero Flow
-- companies (company_id) and external companies (ext_company_id).
-- Accountants own and manage their companies' charts.

CREATE TABLE public.account_plans (
  id             uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id     uuid REFERENCES public.companies(id) ON DELETE CASCADE,
  ext_company_id uuid REFERENCES public.external_companies(id) ON DELETE CASCADE,
  accountant_id  uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  parent_id      uuid REFERENCES public.account_plans(id) ON DELETE RESTRICT,
  code           text NOT NULL,
  name           text NOT NULL,
  account_type   text NOT NULL CHECK (account_type IN (
                   'ativo', 'passivo', 'patrimonio_liquido',
                   'receita', 'despesa', 'custo'
                 )),
  nature         text NOT NULL CHECK (nature IN ('devedora', 'credora')),
  is_analytic    boolean NOT NULL DEFAULT true,
  is_active      boolean NOT NULL DEFAULT true,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT check_one_company CHECK (
    (company_id IS NOT NULL AND ext_company_id IS NULL) OR
    (company_id IS NULL AND ext_company_id IS NOT NULL)
  ),
  UNIQUE NULLS NOT DISTINCT (company_id, code),
  UNIQUE NULLS NOT DISTINCT (ext_company_id, code)
);

CREATE TRIGGER trg_account_plans_updated_at
  BEFORE UPDATE ON public.account_plans
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE INDEX idx_account_plans_company ON public.account_plans (company_id, parent_id)
  WHERE company_id IS NOT NULL;
CREATE INDEX idx_account_plans_ext_company ON public.account_plans (ext_company_id, parent_id)
  WHERE ext_company_id IS NOT NULL;
CREATE INDEX idx_account_plans_accountant ON public.account_plans (accountant_id);

ALTER TABLE public.account_plans ENABLE ROW LEVEL SECURITY;

-- Accountant sees plans they created, or is linked accountant of the Syncero company
CREATE POLICY "Accountant reads account plans"
  ON public.account_plans
  FOR SELECT
  USING (
    accountant_id = auth.uid()
    OR (company_id IS NOT NULL AND public.is_accountant_of(company_id))
  );

CREATE POLICY "Accountant writes own account plans"
  ON public.account_plans
  FOR INSERT
  WITH CHECK (accountant_id = auth.uid());

CREATE POLICY "Accountant updates own account plans"
  ON public.account_plans
  FOR UPDATE
  USING (accountant_id = auth.uid())
  WITH CHECK (accountant_id = auth.uid());

CREATE POLICY "Accountant deletes own account plans"
  ON public.account_plans
  FOR DELETE
  USING (accountant_id = auth.uid());
