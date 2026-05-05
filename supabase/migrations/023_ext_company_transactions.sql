-- Allow accountants to create transactions for external companies.
-- company_id becomes nullable; exactly one of the two must be set.

ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS ext_company_id uuid
    REFERENCES public.external_companies(id) ON DELETE CASCADE;

ALTER TABLE public.transactions
  ALTER COLUMN company_id DROP NOT NULL;

ALTER TABLE public.transactions
  ADD CONSTRAINT transactions_company_xor
  CHECK (num_nonnulls(company_id, ext_company_id) = 1);

CREATE INDEX IF NOT EXISTS idx_transactions_ext_company_id
  ON public.transactions(ext_company_id);

-- RLS: accountant can fully manage transactions for their external companies
CREATE POLICY "accountant manages ext company transactions"
  ON public.transactions
  FOR ALL
  USING (
    ext_company_id IS NOT NULL AND
    EXISTS (
      SELECT 1 FROM public.external_companies ec
      WHERE ec.id = transactions.ext_company_id
        AND ec.accountant_id = auth.uid()
        AND ec.is_active = true
    )
  )
  WITH CHECK (
    ext_company_id IS NOT NULL AND
    EXISTS (
      SELECT 1 FROM public.external_companies ec
      WHERE ec.id = transactions.ext_company_id
        AND ec.accountant_id = auth.uid()
        AND ec.is_active = true
    )
  );
