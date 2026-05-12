-- Migration 024: Fix tax_calculations table
-- Align status enum with frontend expectations, add accountant_id and calculated_at.

ALTER TABLE public.tax_calculations
  DROP CONSTRAINT IF EXISTS tax_calculations_status_check;

UPDATE public.tax_calculations SET status = 'draft'
  WHERE status IN ('open', 'overdue');

ALTER TABLE public.tax_calculations
  ADD CONSTRAINT tax_calculations_status_check
    CHECK (status IN ('draft', 'calculated', 'paid'));

ALTER TABLE public.tax_calculations
  ADD COLUMN IF NOT EXISTS accountant_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE public.tax_calculations
  ADD COLUMN IF NOT EXISTS calculated_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_tax_calculations_accountant
  ON public.tax_calculations (accountant_id);
