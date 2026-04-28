-- Migration 019: Add 'product_cost' to valid transaction natures
-- Available only for companies with segments: comercio, industria, agronegocio, construcao_civil.
-- Enforced at application level; maps to account_type = 'custo' in the chart of accounts.

-- No schema changes needed (nature column has no check constraint).
-- This migration documents the new valid value for future reference.

COMMENT ON COLUMN public.transactions.nature IS
  'Income: sale_service | loan_received | capital_contribution
   Expense: operational_expense | product_cost | asset_purchase | debt_payment | owner_withdrawal
   product_cost available only for segments: comercio, industria, agronegocio, construcao_civil';
