-- Migration 005: Accounting journal entries (Lançamentos Contábeis)
-- Double-entry bookkeeping: each journal_entry has N lines (debit/credit).
-- Balance is enforced at application layer (sum debits = sum credits).
-- Supports both Syncero Flow companies and external companies.

CREATE TYPE public.entry_source AS ENUM (
  'manual',
  'dominio_import',
  'api',
  'syncero_import'
);

CREATE TABLE public.journal_entries (
  id             uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id     uuid REFERENCES public.companies(id) ON DELETE CASCADE,
  ext_company_id uuid REFERENCES public.external_companies(id) ON DELETE CASCADE,
  accountant_id  uuid NOT NULL REFERENCES public.profiles(id),
  entry_date     date NOT NULL,
  description    text NOT NULL,
  source         public.entry_source NOT NULL DEFAULT 'manual',
  external_ref   text,
  is_reversed    boolean NOT NULL DEFAULT false,
  reversal_of    uuid REFERENCES public.journal_entries(id),
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT check_one_company CHECK (
    (company_id IS NOT NULL AND ext_company_id IS NULL) OR
    (company_id IS NULL AND ext_company_id IS NOT NULL)
  )
);

CREATE TABLE public.journal_entry_lines (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  entry_id        uuid NOT NULL REFERENCES public.journal_entries(id) ON DELETE CASCADE,
  account_plan_id uuid NOT NULL REFERENCES public.account_plans(id),
  side            text NOT NULL CHECK (side IN ('debit', 'credit')),
  amount          numeric(15, 2) NOT NULL CHECK (amount > 0),
  memo            text,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER trg_journal_entries_updated_at
  BEFORE UPDATE ON public.journal_entries
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE INDEX idx_journal_entries_company ON public.journal_entries (company_id, entry_date DESC)
  WHERE company_id IS NOT NULL;
CREATE INDEX idx_journal_entries_ext_company ON public.journal_entries (ext_company_id, entry_date DESC)
  WHERE ext_company_id IS NOT NULL;
CREATE INDEX idx_journal_entries_accountant ON public.journal_entries (accountant_id);
CREATE INDEX idx_journal_entry_lines_entry ON public.journal_entry_lines (entry_id);
CREATE INDEX idx_journal_entry_lines_account ON public.journal_entry_lines (account_plan_id);

-- Helper functions (SECURITY DEFINER — bypass RLS safely)
CREATE OR REPLACE FUNCTION public.can_read_journal_entry(p_entry_id uuid)
RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.journal_entries je
    WHERE je.id = p_entry_id
      AND (
        je.accountant_id = auth.uid()
        OR (je.company_id IS NOT NULL AND public.is_accountant_of(je.company_id))
      )
  );
$$;

CREATE OR REPLACE FUNCTION public.can_write_journal_entry(p_entry_id uuid)
RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.journal_entries
    WHERE id = p_entry_id AND accountant_id = auth.uid()
  );
$$;

ALTER TABLE public.journal_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.journal_entry_lines ENABLE ROW LEVEL SECURITY;

-- journal_entries policies
CREATE POLICY "Accountant reads journal entries"
  ON public.journal_entries
  FOR SELECT
  USING (
    accountant_id = auth.uid()
    OR (company_id IS NOT NULL AND public.is_accountant_of(company_id))
  );

CREATE POLICY "Accountant writes journal entries"
  ON public.journal_entries
  FOR INSERT
  WITH CHECK (accountant_id = auth.uid());

CREATE POLICY "Accountant updates own journal entries"
  ON public.journal_entries
  FOR UPDATE
  USING (accountant_id = auth.uid())
  WITH CHECK (accountant_id = auth.uid());

CREATE POLICY "Accountant deletes own journal entries"
  ON public.journal_entries
  FOR DELETE
  USING (accountant_id = auth.uid());

-- journal_entry_lines policies
CREATE POLICY "Read entry lines"
  ON public.journal_entry_lines
  FOR SELECT
  USING (public.can_read_journal_entry(entry_id));

CREATE POLICY "Write entry lines"
  ON public.journal_entry_lines
  FOR INSERT
  WITH CHECK (public.can_write_journal_entry(entry_id));

CREATE POLICY "Update entry lines"
  ON public.journal_entry_lines
  FOR UPDATE
  USING (public.can_write_journal_entry(entry_id))
  WITH CHECK (public.can_write_journal_entry(entry_id));

CREATE POLICY "Delete entry lines"
  ON public.journal_entry_lines
  FOR DELETE
  USING (public.can_write_journal_entry(entry_id));
