-- Migration 025: ISS rate per company
-- Stored on accountant_companies for linked companies (accountant's fiscal config, not company data).
-- Stored on external_companies for external companies (accountant owns all data there).

ALTER TABLE public.accountant_companies
  ADD COLUMN IF NOT EXISTS iss_rate numeric(5, 4) DEFAULT NULL
    CHECK (iss_rate IS NULL OR (iss_rate >= 0 AND iss_rate <= 0.05));

ALTER TABLE public.external_companies
  ADD COLUMN IF NOT EXISTS iss_rate numeric(5, 4) DEFAULT NULL
    CHECK (iss_rate IS NULL OR (iss_rate >= 0 AND iss_rate <= 0.05));
