-- Migration 026: Extend tax_calculations for external companies + segment on accountant_companies

ALTER TABLE public.accountant_companies
  ADD COLUMN IF NOT EXISTS segment text
    CHECK (segment IN ('retail','services','manufacturing','construction',
                       'agribusiness','healthcare','education','technology','financial','other'));

ALTER TABLE public.tax_calculations ALTER COLUMN company_id DROP NOT NULL;

ALTER TABLE public.tax_calculations
  ADD COLUMN IF NOT EXISTS ext_company_id uuid
    REFERENCES public.external_companies(id) ON DELETE CASCADE;

ALTER TABLE public.tax_calculations
  ADD CONSTRAINT tax_calc_check_one_company CHECK (
    (company_id IS NOT NULL AND ext_company_id IS NULL) OR
    (company_id IS NULL   AND ext_company_id IS NOT NULL)
  );

CREATE INDEX IF NOT EXISTS idx_tax_calc_ext_company
  ON public.tax_calculations (ext_company_id, period)
  WHERE ext_company_id IS NOT NULL;
