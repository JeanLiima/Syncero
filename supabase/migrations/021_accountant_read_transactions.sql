-- Migration 021: Allow accountants to read transactions for their linked companies.
-- Required for Supabase Realtime subscriptions from the Books frontend.

DROP POLICY IF EXISTS "Membro vê lançamentos" ON public.transactions;

CREATE POLICY "Membro ou contador vê lançamentos"
  ON public.transactions FOR SELECT
  USING (
    public.is_company_member(company_id)
    OR public.is_accountant_of(company_id)
  );
