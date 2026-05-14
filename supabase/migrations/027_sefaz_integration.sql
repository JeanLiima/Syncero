-- Migration 027: Integração SEFAZ DF-e
-- Armazenamento seguro de certificados A1 e extensão de fiscal_documents

-- ── Tabela de credenciais SEFAZ por empresa ────────────────────
CREATE TABLE public.company_sefaz_credentials (
  id                 uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id         uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE UNIQUE,
  cert_pfx_enc       text NOT NULL,               -- PFX criptografado com AES-256-GCM (base64)
  cert_pfx_iv        text NOT NULL,               -- IV do AES-GCM (base64)
  cert_password_enc  text NOT NULL,               -- Senha criptografada (base64)
  cert_password_iv   text NOT NULL,               -- IV da senha (base64)
  environment        text NOT NULL DEFAULT 'production'
                     CHECK (environment IN ('production', 'homologation')),
  uf_code            text NOT NULL,               -- Código IBGE da UF (ex: '35' = SP)
  last_nsu           text NOT NULL DEFAULT '000000000000000',
  last_sync_at       timestamptz,
  last_error         text,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.company_sefaz_credentials ENABLE ROW LEVEL SECURITY;

-- Apenas admin vê e gerencia credenciais
CREATE POLICY "Admin vê credenciais SEFAZ"
  ON public.company_sefaz_credentials FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.company_members cm
      WHERE cm.company_id = company_sefaz_credentials.company_id
        AND cm.user_id = auth.uid()
        AND cm.role = 'admin'
        AND cm.status = 'accepted'
    )
  );

CREATE POLICY "Admin gerencia credenciais SEFAZ"
  ON public.company_sefaz_credentials FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.company_members cm
      WHERE cm.company_id = company_sefaz_credentials.company_id
        AND cm.user_id = auth.uid()
        AND cm.role = 'admin'
        AND cm.status = 'accepted'
    )
  );

CREATE TRIGGER trg_sefaz_cred_updated_at
  BEFORE UPDATE ON public.company_sefaz_credentials
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ── Extensões à tabela fiscal_documents ───────────────────────

ALTER TABLE public.fiscal_documents
  ADD COLUMN IF NOT EXISTS transaction_id uuid
    REFERENCES public.transactions(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS access_key text,           -- chave de acesso 44 dígitos
  ADD COLUMN IF NOT EXISTS issuer_cnpj text,
  ADD COLUMN IF NOT EXISTS issuer_name text,
  ADD COLUMN IF NOT EXISTS recipient_cnpj text,
  ADD COLUMN IF NOT EXISTS recipient_name text,
  ADD COLUMN IF NOT EXISTS doc_direction text
    CHECK (doc_direction IN ('income', 'expense')),
  ADD COLUMN IF NOT EXISTS nsu text,                  -- NSU do DF-e SEFAZ
  ADD COLUMN IF NOT EXISTS doc_status text DEFAULT 'authorized'
    CHECK (doc_status IN ('authorized', 'cancelled', 'denied')),
  ADD COLUMN IF NOT EXISTS source text DEFAULT 'upload'
    CHECK (source IN ('upload', 'sefaz_sync'));

-- Deduplicação por chave de acesso
CREATE UNIQUE INDEX IF NOT EXISTS idx_fiscal_docs_access_key
  ON public.fiscal_documents (access_key)
  WHERE access_key IS NOT NULL;

-- Docs pendentes de lançamento (sem transaction vinculada)
CREATE INDEX IF NOT EXISTS idx_fiscal_docs_pending
  ON public.fiscal_documents (company_id, issue_date DESC)
  WHERE transaction_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_fiscal_docs_nsu
  ON public.fiscal_documents (company_id, nsu)
  WHERE nsu IS NOT NULL;

-- Política de UPDATE para vincular transaction_id
CREATE POLICY "Membro atualiza documentos fiscais"
  ON public.fiscal_documents FOR UPDATE
  USING (public.is_company_member(company_id));

-- ── pg_cron: sincronização a cada 4 horas ─────────────────────
-- Requer extensões pg_cron e pg_net ativadas no projeto Supabase.
-- Execute manualmente no SQL Editor se ainda não estiver ativo:
--
--   SELECT cron.schedule(
--     'sefaz-sync',
--     '0 */4 * * *',
--     $$
--       SELECT net.http_post(
--         url := current_setting('app.supabase_url') || '/functions/v1/sefaz-sync',
--         headers := jsonb_build_object(
--           'Content-Type', 'application/json',
--           'Authorization', 'Bearer ' || current_setting('app.service_role_key')
--         ),
--         body := '{}'::jsonb
--       );
--     $$
--   );
