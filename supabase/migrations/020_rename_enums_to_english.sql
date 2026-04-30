-- Migration 020: Rename Portuguese enum values to English

-- account_plans.account_type
ALTER TABLE account_plans DROP CONSTRAINT IF EXISTS account_plans_account_type_check;
UPDATE account_plans SET account_type = CASE account_type
  WHEN 'ativo'              THEN 'asset'
  WHEN 'passivo'            THEN 'liability'
  WHEN 'patrimonio_liquido' THEN 'equity'
  WHEN 'receita'            THEN 'revenue'
  WHEN 'despesa'            THEN 'expense'
  WHEN 'custo'              THEN 'cost'
  ELSE account_type
END;
ALTER TABLE account_plans ADD CONSTRAINT account_plans_account_type_check
  CHECK (account_type IN ('asset','liability','equity','revenue','expense','cost'));

-- account_plans.nature
ALTER TABLE account_plans DROP CONSTRAINT IF EXISTS account_plans_nature_check;
UPDATE account_plans SET nature = CASE nature
  WHEN 'devedora' THEN 'debit'
  WHEN 'credora'  THEN 'credit'
  ELSE nature
END;
ALTER TABLE account_plans ADD CONSTRAINT account_plans_nature_check
  CHECK (nature IN ('debit','credit'));

-- companies.segment
ALTER TABLE companies DROP CONSTRAINT IF EXISTS companies_segment_check;
UPDATE companies SET segment = CASE segment
  WHEN 'comercio'        THEN 'retail'
  WHEN 'servicos'        THEN 'services'
  WHEN 'industria'       THEN 'manufacturing'
  WHEN 'construcao_civil' THEN 'construction'
  WHEN 'agronegocio'     THEN 'agribusiness'
  WHEN 'saude'           THEN 'healthcare'
  WHEN 'educacao'        THEN 'education'
  WHEN 'tecnologia'      THEN 'technology'
  WHEN 'financeiro'      THEN 'financial'
  WHEN 'outros'          THEN 'other'
  ELSE segment
END;
ALTER TABLE companies ADD CONSTRAINT companies_segment_check
  CHECK (segment IN ('retail','services','manufacturing','construction','agribusiness','healthcare','education','technology','financial','other'));

-- external_companies.segment
ALTER TABLE external_companies DROP CONSTRAINT IF EXISTS external_companies_segment_check;
UPDATE external_companies SET segment = CASE segment
  WHEN 'comercio'        THEN 'retail'
  WHEN 'servicos'        THEN 'services'
  WHEN 'industria'       THEN 'manufacturing'
  WHEN 'construcao_civil' THEN 'construction'
  WHEN 'agronegocio'     THEN 'agribusiness'
  WHEN 'saude'           THEN 'healthcare'
  WHEN 'educacao'        THEN 'education'
  WHEN 'tecnologia'      THEN 'technology'
  WHEN 'financeiro'      THEN 'financial'
  WHEN 'outros'          THEN 'other'
  ELSE segment
END;
ALTER TABLE external_companies ADD CONSTRAINT external_companies_segment_check
  CHECK (segment IN ('retail','services','manufacturing','construction','agribusiness','healthcare','education','technology','financial','other'));

-- Update comment on transactions.nature to reflect new segment values
COMMENT ON COLUMN public.transactions.nature IS
  'Income: sale_service | loan_received | capital_contribution
   Expense: operational_expense | product_cost | asset_purchase | debt_payment | owner_withdrawal
   product_cost available only for segments: retail, manufacturing, agribusiness, construction';
