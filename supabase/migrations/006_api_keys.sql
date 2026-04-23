-- Migration 006: API keys for external integrations
-- Allows accountants to generate API keys scoped to a specific company,
-- enabling external software (Domínio, etc.) to POST journal entries via
-- the books-api Edge Function. Raw keys are never stored — only SHA-256 hash.

CREATE TABLE public.api_keys (
  id             uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  accountant_id  uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  company_id     uuid REFERENCES public.companies(id) ON DELETE CASCADE,
  ext_company_id uuid REFERENCES public.external_companies(id) ON DELETE CASCADE,
  name           text NOT NULL,
  key_hash       text NOT NULL UNIQUE,
  key_prefix     text NOT NULL,
  last_used_at   timestamptz,
  expires_at     timestamptz,
  is_active      boolean NOT NULL DEFAULT true,
  created_at     timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT check_one_company CHECK (
    (company_id IS NOT NULL AND ext_company_id IS NULL) OR
    (company_id IS NULL AND ext_company_id IS NOT NULL)
  )
);

CREATE INDEX idx_api_keys_accountant ON public.api_keys (accountant_id, is_active);
CREATE INDEX idx_api_keys_hash ON public.api_keys (key_hash) WHERE is_active = true;

ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Accountant manages own API keys"
  ON public.api_keys
  FOR ALL
  USING (accountant_id = auth.uid())
  WITH CHECK (accountant_id = auth.uid());
