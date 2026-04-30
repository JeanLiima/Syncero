-- Migration 017: Link journal entries to Flow transactions
-- Allows accountants in Books to classify Flow transactions into journal entries.

ALTER TABLE public.journal_entries
  ADD COLUMN flow_transaction_id uuid REFERENCES public.transactions(id) ON DELETE SET NULL;

-- One journal entry per Flow transaction (no double-classification)
CREATE UNIQUE INDEX idx_journal_entries_flow_tx
  ON public.journal_entries (flow_transaction_id)
  WHERE flow_transaction_id IS NOT NULL;

-- Fast lookup: which transactions have been classified?
CREATE INDEX idx_journal_entries_flow_tx_lookup
  ON public.journal_entries (company_id, flow_transaction_id)
  WHERE flow_transaction_id IS NOT NULL;
