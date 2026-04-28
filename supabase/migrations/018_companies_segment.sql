-- Migration 018: Add segment column to companies table
ALTER TABLE public.companies
  ADD COLUMN segment text CHECK (segment IN (
    'comercio', 'servicos', 'industria', 'construcao_civil',
    'agronegocio', 'saude', 'educacao', 'tecnologia', 'financeiro', 'outros'
  ));
