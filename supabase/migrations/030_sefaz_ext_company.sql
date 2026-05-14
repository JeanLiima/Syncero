-- Migration 030: SEFAZ credentials para empresas externas (Books / contador)

-- company_id passa a ser nullable (XOR com ext_company_id)
ALTER TABLE public.company_sefaz_credentials
  ALTER COLUMN company_id DROP NOT NULL;

-- Adiciona ext_company_id e accountant_id (quem gerencia o cert da empresa externa)
ALTER TABLE public.company_sefaz_credentials
  ADD COLUMN IF NOT EXISTS ext_company_id uuid
    REFERENCES public.external_companies(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS accountant_id uuid
    REFERENCES public.profiles(id);

-- XOR: exatamente um dos dois deve estar preenchido
ALTER TABLE public.company_sefaz_credentials
  ADD CONSTRAINT sefaz_cred_one_company CHECK (
    (company_id IS NOT NULL AND ext_company_id IS NULL) OR
    (company_id IS NULL   AND ext_company_id IS NOT NULL)
  );

-- Unique parcial por tipo
ALTER TABLE public.company_sefaz_credentials
  DROP CONSTRAINT IF EXISTS company_sefaz_credentials_company_id_key;

CREATE UNIQUE INDEX IF NOT EXISTS idx_sefaz_cred_company
  ON public.company_sefaz_credentials (company_id)
  WHERE company_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_sefaz_cred_ext_company
  ON public.company_sefaz_credentials (ext_company_id)
  WHERE ext_company_id IS NOT NULL;

-- RLS: contador vê credencial de empresa interna vinculada (leitura)
CREATE POLICY "Contador vê credencial SEFAZ empresa interna"
  ON public.company_sefaz_credentials FOR SELECT
  USING (
    company_id IS NOT NULL AND
    EXISTS (
      SELECT 1 FROM public.accountant_companies ac
      WHERE ac.company_id = company_sefaz_credentials.company_id
        AND ac.accountant_id = auth.uid()
        AND ac.status = 'accepted'
    )
  );

-- RLS: contador gerencia credencial de empresa externa (full CRUD)
CREATE POLICY "Contador gerencia credencial SEFAZ empresa externa"
  ON public.company_sefaz_credentials FOR ALL
  USING (
    ext_company_id IS NOT NULL AND
    accountant_id = auth.uid()
  );
