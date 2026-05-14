-- fiscal_books: make company_id nullable, add ext_company_id (same XOR pattern as other tables)

ALTER TABLE public.fiscal_books
  ALTER COLUMN company_id DROP NOT NULL;

ALTER TABLE public.fiscal_books
  ADD COLUMN ext_company_id uuid REFERENCES public.external_companies(id) ON DELETE CASCADE;

ALTER TABLE public.fiscal_books
  ADD CONSTRAINT fiscal_books_company_xor
    CHECK (
      (company_id IS NOT NULL AND ext_company_id IS NULL) OR
      (company_id IS NULL AND ext_company_id IS NOT NULL)
    );

CREATE INDEX fiscal_books_ext_company_idx ON public.fiscal_books(ext_company_id);

-- RLS: accountants can manage fiscal_books for external companies they own
CREATE POLICY "accountant_ext_fiscal_books"
  ON public.fiscal_books
  FOR ALL
  USING (
    ext_company_id IS NOT NULL AND
    EXISTS (
      SELECT 1 FROM public.external_companies ec
      WHERE ec.id = fiscal_books.ext_company_id
        AND ec.accountant_id = auth.uid()
    )
  )
  WITH CHECK (
    ext_company_id IS NOT NULL AND
    EXISTS (
      SELECT 1 FROM public.external_companies ec
      WHERE ec.id = fiscal_books.ext_company_id
        AND ec.accountant_id = auth.uid()
    )
  );
