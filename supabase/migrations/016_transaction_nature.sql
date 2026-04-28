-- Add nature column to transactions
-- Captures the accounting nature of each transaction in business-friendly terms.
-- NULL means the company did not classify (old records or optional skip).

ALTER TABLE transactions
  ADD COLUMN IF NOT EXISTS nature text;

-- Valid values (enforced at app level, not constraint, for forward compatibility):
-- Income (entrada):  'sale_service' | 'loan_received' | 'capital_contribution'
-- Expense (saída):   'operational_expense' | 'asset_purchase' | 'debt_payment' | 'owner_withdrawal'
