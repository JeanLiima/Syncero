-- fiscal_books: align schema with actual code usage
--
-- The original table (migration 001) used:
--   period text NOT NULL          → code expects reference_period
--   no transmitted_at column      → code uses this field
--   book_type: sped_fiscal|sped_contribuicoes|sped_contabil
--                                 → code uses ecf and ecd
--
-- This migration aligns the DB to match the current codebase.

-- 1. Add reference_period (populate from existing period column)
ALTER TABLE public.fiscal_books
  ADD COLUMN IF NOT EXISTS reference_period text;

UPDATE public.fiscal_books
  SET reference_period = period
  WHERE reference_period IS NULL;

ALTER TABLE public.fiscal_books
  ALTER COLUMN reference_period SET NOT NULL;

-- 2. Add transmitted_at
ALTER TABLE public.fiscal_books
  ADD COLUMN IF NOT EXISTS transmitted_at timestamptz;

-- 3. Expand book_type constraint to include ecf and ecd
ALTER TABLE public.fiscal_books
  DROP CONSTRAINT IF EXISTS fiscal_books_book_type_check;

ALTER TABLE public.fiscal_books
  ADD CONSTRAINT fiscal_books_book_type_check
  CHECK (book_type IN ('sped_fiscal', 'sped_contribuicoes', 'sped_contabil', 'ecf', 'ecd'));
