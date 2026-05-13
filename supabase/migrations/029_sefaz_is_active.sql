-- Migration 029: campo is_active em company_sefaz_credentials

ALTER TABLE public.company_sefaz_credentials
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;
