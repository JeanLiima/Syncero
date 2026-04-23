type AccountType = 'ativo' | 'passivo' | 'patrimonio_liquido' | 'receita' | 'despesa' | 'custo'
type AccountNature = 'devedora' | 'credora'

interface AccountTemplate {
  code: string
  name: string
  account_type: AccountType
  nature: AccountNature
  is_analytic: boolean
  parent_code: string | null
}

export const DEFAULT_ACCOUNT_PLAN: AccountTemplate[] = [
  // ── 1 ATIVO ──────────────────────────────────────────────────
  { code: '1', name: 'ATIVO', account_type: 'ativo', nature: 'devedora', is_analytic: false, parent_code: null },
  { code: '1.1', name: 'ATIVO CIRCULANTE', account_type: 'ativo', nature: 'devedora', is_analytic: false, parent_code: '1' },
  { code: '1.1.1', name: 'CAIXA E EQUIVALENTES DE CAIXA', account_type: 'ativo', nature: 'devedora', is_analytic: false, parent_code: '1.1' },
  { code: '1.1.1.01', name: 'Caixa', account_type: 'ativo', nature: 'devedora', is_analytic: true, parent_code: '1.1.1' },
  { code: '1.1.1.02', name: 'Banco conta movimento', account_type: 'ativo', nature: 'devedora', is_analytic: true, parent_code: '1.1.1' },
  { code: '1.1.2', name: 'CLIENTES', account_type: 'ativo', nature: 'devedora', is_analytic: false, parent_code: '1.1' },
  { code: '1.1.2.01', name: 'Clientes a receber', account_type: 'ativo', nature: 'devedora', is_analytic: true, parent_code: '1.1.2' },
  { code: '1.1.3', name: 'ESTOQUES', account_type: 'ativo', nature: 'devedora', is_analytic: false, parent_code: '1.1' },
  { code: '1.1.3.01', name: 'Mercadorias para revenda', account_type: 'ativo', nature: 'devedora', is_analytic: true, parent_code: '1.1.3' },
  { code: '1.1.4', name: 'OUTROS ATIVOS CIRCULANTES', account_type: 'ativo', nature: 'devedora', is_analytic: false, parent_code: '1.1' },
  { code: '1.1.4.01', name: 'Impostos a recuperar', account_type: 'ativo', nature: 'devedora', is_analytic: true, parent_code: '1.1.4' },
  { code: '1.1.4.02', name: 'Adiantamentos a fornecedores', account_type: 'ativo', nature: 'devedora', is_analytic: true, parent_code: '1.1.4' },
  { code: '1.2', name: 'ATIVO NÃO CIRCULANTE', account_type: 'ativo', nature: 'devedora', is_analytic: false, parent_code: '1' },
  { code: '1.2.1', name: 'IMOBILIZADO', account_type: 'ativo', nature: 'devedora', is_analytic: false, parent_code: '1.2' },
  { code: '1.2.1.01', name: 'Máquinas e equipamentos', account_type: 'ativo', nature: 'devedora', is_analytic: true, parent_code: '1.2.1' },
  { code: '1.2.1.02', name: 'Móveis e utensílios', account_type: 'ativo', nature: 'devedora', is_analytic: true, parent_code: '1.2.1' },
  { code: '1.2.1.03', name: 'Veículos', account_type: 'ativo', nature: 'devedora', is_analytic: true, parent_code: '1.2.1' },
  { code: '1.2.2', name: 'DEPRECIAÇÃO ACUMULADA', account_type: 'ativo', nature: 'credora', is_analytic: false, parent_code: '1.2' },
  { code: '1.2.2.01', name: 'Depreciação acumulada — Máquinas', account_type: 'ativo', nature: 'credora', is_analytic: true, parent_code: '1.2.2' },
  { code: '1.2.2.02', name: 'Depreciação acumulada — Móveis', account_type: 'ativo', nature: 'credora', is_analytic: true, parent_code: '1.2.2' },
  { code: '1.2.2.03', name: 'Depreciação acumulada — Veículos', account_type: 'ativo', nature: 'credora', is_analytic: true, parent_code: '1.2.2' },

  // ── 2 PASSIVO ─────────────────────────────────────────────────
  { code: '2', name: 'PASSIVO', account_type: 'passivo', nature: 'credora', is_analytic: false, parent_code: null },
  { code: '2.1', name: 'PASSIVO CIRCULANTE', account_type: 'passivo', nature: 'credora', is_analytic: false, parent_code: '2' },
  { code: '2.1.1', name: 'FORNECEDORES', account_type: 'passivo', nature: 'credora', is_analytic: false, parent_code: '2.1' },
  { code: '2.1.1.01', name: 'Fornecedores a pagar', account_type: 'passivo', nature: 'credora', is_analytic: true, parent_code: '2.1.1' },
  { code: '2.1.2', name: 'OBRIGAÇÕES FISCAIS', account_type: 'passivo', nature: 'credora', is_analytic: false, parent_code: '2.1' },
  { code: '2.1.2.01', name: 'Simples Nacional a recolher', account_type: 'passivo', nature: 'credora', is_analytic: true, parent_code: '2.1.2' },
  { code: '2.1.2.02', name: 'IRPJ a recolher', account_type: 'passivo', nature: 'credora', is_analytic: true, parent_code: '2.1.2' },
  { code: '2.1.2.03', name: 'CSLL a recolher', account_type: 'passivo', nature: 'credora', is_analytic: true, parent_code: '2.1.2' },
  { code: '2.1.2.04', name: 'PIS a recolher', account_type: 'passivo', nature: 'credora', is_analytic: true, parent_code: '2.1.2' },
  { code: '2.1.2.05', name: 'COFINS a recolher', account_type: 'passivo', nature: 'credora', is_analytic: true, parent_code: '2.1.2' },
  { code: '2.1.3', name: 'OBRIGAÇÕES TRABALHISTAS', account_type: 'passivo', nature: 'credora', is_analytic: false, parent_code: '2.1' },
  { code: '2.1.3.01', name: 'Salários a pagar', account_type: 'passivo', nature: 'credora', is_analytic: true, parent_code: '2.1.3' },
  { code: '2.1.3.02', name: 'INSS a recolher', account_type: 'passivo', nature: 'credora', is_analytic: true, parent_code: '2.1.3' },
  { code: '2.1.3.03', name: 'FGTS a recolher', account_type: 'passivo', nature: 'credora', is_analytic: true, parent_code: '2.1.3' },
  { code: '2.2', name: 'PASSIVO NÃO CIRCULANTE', account_type: 'passivo', nature: 'credora', is_analytic: false, parent_code: '2' },
  { code: '2.2.1', name: 'EMPRÉSTIMOS E FINANCIAMENTOS', account_type: 'passivo', nature: 'credora', is_analytic: false, parent_code: '2.2' },
  { code: '2.2.1.01', name: 'Empréstimos bancários — LP', account_type: 'passivo', nature: 'credora', is_analytic: true, parent_code: '2.2.1' },

  // ── 3 PATRIMÔNIO LÍQUIDO ──────────────────────────────────────
  { code: '3', name: 'PATRIMÔNIO LÍQUIDO', account_type: 'patrimonio_liquido', nature: 'credora', is_analytic: false, parent_code: null },
  { code: '3.1', name: 'CAPITAL SOCIAL', account_type: 'patrimonio_liquido', nature: 'credora', is_analytic: false, parent_code: '3' },
  { code: '3.1.1.01', name: 'Capital social subscrito', account_type: 'patrimonio_liquido', nature: 'credora', is_analytic: true, parent_code: '3.1' },
  { code: '3.2', name: 'RESERVAS E RESULTADOS', account_type: 'patrimonio_liquido', nature: 'credora', is_analytic: false, parent_code: '3' },
  { code: '3.2.1.01', name: 'Lucros acumulados', account_type: 'patrimonio_liquido', nature: 'credora', is_analytic: true, parent_code: '3.2' },
  { code: '3.2.1.02', name: 'Prejuízos acumulados', account_type: 'patrimonio_liquido', nature: 'devedora', is_analytic: true, parent_code: '3.2' },

  // ── 4 RECEITAS ────────────────────────────────────────────────
  { code: '4', name: 'RECEITAS', account_type: 'receita', nature: 'credora', is_analytic: false, parent_code: null },
  { code: '4.1', name: 'RECEITA BRUTA', account_type: 'receita', nature: 'credora', is_analytic: false, parent_code: '4' },
  { code: '4.1.1.01', name: 'Venda de mercadorias', account_type: 'receita', nature: 'credora', is_analytic: true, parent_code: '4.1' },
  { code: '4.1.1.02', name: 'Prestação de serviços', account_type: 'receita', nature: 'credora', is_analytic: true, parent_code: '4.1' },
  { code: '4.2', name: 'DEDUÇÕES DA RECEITA', account_type: 'receita', nature: 'devedora', is_analytic: false, parent_code: '4' },
  { code: '4.2.1.01', name: 'Devoluções de vendas', account_type: 'receita', nature: 'devedora', is_analytic: true, parent_code: '4.2' },
  { code: '4.2.1.02', name: 'Impostos sobre vendas', account_type: 'receita', nature: 'devedora', is_analytic: true, parent_code: '4.2' },
  { code: '4.3', name: 'RECEITAS FINANCEIRAS', account_type: 'receita', nature: 'credora', is_analytic: false, parent_code: '4' },
  { code: '4.3.1.01', name: 'Juros recebidos', account_type: 'receita', nature: 'credora', is_analytic: true, parent_code: '4.3' },
  { code: '4.3.1.02', name: 'Rendimentos de aplicações', account_type: 'receita', nature: 'credora', is_analytic: true, parent_code: '4.3' },

  // ── 5 DESPESAS ────────────────────────────────────────────────
  { code: '5', name: 'DESPESAS', account_type: 'despesa', nature: 'devedora', is_analytic: false, parent_code: null },
  { code: '5.1', name: 'DESPESAS OPERACIONAIS', account_type: 'despesa', nature: 'devedora', is_analytic: false, parent_code: '5' },
  { code: '5.1.1.01', name: 'Salários e encargos', account_type: 'despesa', nature: 'devedora', is_analytic: true, parent_code: '5.1' },
  { code: '5.1.1.02', name: 'Aluguel', account_type: 'despesa', nature: 'devedora', is_analytic: true, parent_code: '5.1' },
  { code: '5.1.1.03', name: 'Energia elétrica', account_type: 'despesa', nature: 'devedora', is_analytic: true, parent_code: '5.1' },
  { code: '5.1.1.04', name: 'Telefone e internet', account_type: 'despesa', nature: 'devedora', is_analytic: true, parent_code: '5.1' },
  { code: '5.1.1.05', name: 'Material de escritório', account_type: 'despesa', nature: 'devedora', is_analytic: true, parent_code: '5.1' },
  { code: '5.1.1.06', name: 'Manutenção e reparos', account_type: 'despesa', nature: 'devedora', is_analytic: true, parent_code: '5.1' },
  { code: '5.2', name: 'DESPESAS FINANCEIRAS', account_type: 'despesa', nature: 'devedora', is_analytic: false, parent_code: '5' },
  { code: '5.2.1.01', name: 'Juros sobre empréstimos', account_type: 'despesa', nature: 'devedora', is_analytic: true, parent_code: '5.2' },
  { code: '5.2.1.02', name: 'Tarifas bancárias', account_type: 'despesa', nature: 'devedora', is_analytic: true, parent_code: '5.2' },
  { code: '5.3', name: 'DEPRECIAÇÕES', account_type: 'despesa', nature: 'devedora', is_analytic: false, parent_code: '5' },
  { code: '5.3.1.01', name: 'Depreciação do imobilizado', account_type: 'despesa', nature: 'devedora', is_analytic: true, parent_code: '5.3' },

  // ── 6 CUSTOS ──────────────────────────────────────────────────
  { code: '6', name: 'CUSTOS', account_type: 'custo', nature: 'devedora', is_analytic: false, parent_code: null },
  { code: '6.1', name: 'CUSTO DAS MERCADORIAS VENDIDAS', account_type: 'custo', nature: 'devedora', is_analytic: false, parent_code: '6' },
  { code: '6.1.1.01', name: 'CMV — Mercadorias', account_type: 'custo', nature: 'devedora', is_analytic: true, parent_code: '6.1' },
  { code: '6.2', name: 'CUSTO DOS SERVIÇOS PRESTADOS', account_type: 'custo', nature: 'devedora', is_analytic: false, parent_code: '6' },
  { code: '6.2.1.01', name: 'CSP — Mão de obra direta', account_type: 'custo', nature: 'devedora', is_analytic: true, parent_code: '6.2' },
]
