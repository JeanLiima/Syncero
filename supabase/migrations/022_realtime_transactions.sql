-- Migration 022: Enable Supabase Realtime on transactions and journal_entries.
--
-- REPLICA IDENTITY FULL is required so that UPDATE/DELETE events include
-- the full row in the WAL — without it, column filters like
-- company_id=eq.X don't work on UPDATE events (only INSERT is guaranteed).

ALTER TABLE public.transactions     REPLICA IDENTITY FULL;
ALTER TABLE public.journal_entries  REPLICA IDENTITY FULL;

ALTER PUBLICATION supabase_realtime ADD TABLE public.transactions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.journal_entries;
