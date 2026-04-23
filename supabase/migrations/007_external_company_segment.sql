-- Migration 007: Add segment field to external_companies
ALTER TABLE public.external_companies
  ADD COLUMN segment text CHECK (segment IN (
    'comercio', 'servicos', 'industria', 'construcao_civil',
    'agronegocio', 'saude', 'educacao', 'tecnologia',
    'financeiro', 'outros'
  ));
