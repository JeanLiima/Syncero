-- Migration 031: Permite contador gerenciar certificado SEFAZ de empresa interna vinculada
--
-- O certificado é compartilhado entre Flow (empresa) e Books (contador):
-- quem fizer o upload mais recente define o cert vigente para ambos.

CREATE POLICY "Contador gerencia credencial SEFAZ empresa interna vinculada"
  ON public.company_sefaz_credentials FOR ALL
  USING (
    company_id IS NOT NULL AND
    EXISTS (
      SELECT 1 FROM public.accountant_companies ac
      WHERE ac.company_id = company_sefaz_credentials.company_id
        AND ac.accountant_id = auth.uid()
        AND ac.status = 'accepted'
    )
  )
  WITH CHECK (
    company_id IS NOT NULL AND
    EXISTS (
      SELECT 1 FROM public.accountant_companies ac
      WHERE ac.company_id = company_sefaz_credentials.company_id
        AND ac.accountant_id = auth.uid()
        AND ac.status = 'accepted'
    )
  );
