-- Migration 003: External companies support
-- Adds external_companies table for companies not on Syncero Flow,
-- managed directly by accountants. Also adds company_source discriminator
-- to the existing companies table.

ALTER TABLE public.companies
  ADD COLUMN company_source text NOT NULL DEFAULT 'syncero'
    CHECK (company_source IN ('syncero', 'external'));

CREATE TABLE public.external_companies (
  id            uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  accountant_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name          text NOT NULL,
  cnpj          text,
  trade_name    text,
  tax_regime    text CHECK (tax_regime IN ('simples', 'lucro_presumido', 'lucro_real')),
  integration   text NOT NULL DEFAULT 'manual'
                  CHECK (integration IN ('manual', 'dominio', 'other')),
  is_active     boolean NOT NULL DEFAULT true,
  notes         text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER trg_external_companies_updated_at
  BEFORE UPDATE ON public.external_companies
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE INDEX idx_external_companies_accountant ON public.external_companies (accountant_id)
  WHERE is_active = true;

ALTER TABLE public.external_companies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Accountant manages own external companies"
  ON public.external_companies
  FOR ALL
  USING (accountant_id = auth.uid())
  WITH CHECK (accountant_id = auth.uid());
