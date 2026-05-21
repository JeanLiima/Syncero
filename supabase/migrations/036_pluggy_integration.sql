-- Integração Pluggy: sincronização automática de transações bancárias
-- banks: campos de conexão | transactions: external_id para deduplicação

ALTER TABLE public.banks
  ADD COLUMN pluggy_item_id  text,
  ADD COLUMN sync_enabled    boolean NOT NULL DEFAULT false,
  ADD COLUMN last_synced_at  timestamptz;

-- Garante que um mesmo item Pluggy não seja conectado a duas contas
CREATE UNIQUE INDEX idx_banks_pluggy_item_id
  ON public.banks(pluggy_item_id)
  WHERE pluggy_item_id IS NOT NULL;

-- Campo para deduplicação de transações vindas de fontes externas (Pluggy, etc.)
ALTER TABLE public.transactions
  ADD COLUMN external_id text;

-- Impede que a mesma transação bancária seja importada duas vezes para a mesma empresa
CREATE UNIQUE INDEX idx_transactions_external_id
  ON public.transactions(company_id, external_id)
  WHERE external_id IS NOT NULL AND company_id IS NOT NULL;

-- Transações criadas por webhook/sync automático não têm usuário criador
ALTER TABLE public.transactions
  ALTER COLUMN created_by DROP NOT NULL;
