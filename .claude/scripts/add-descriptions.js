/**
 * Adds missing descriptions to all OpenAPI specs.
 * Descriptions are organized by (path, method, field) and applied to PT and EN specs.
 */
const fs = require('fs')
const path = require('path')
const DIR = path.join(__dirname, '..', 'apps', 'docs', 'public')

const r = (f) => JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8'))
const w = (f, d) => fs.writeFileSync(path.join(DIR, f), JSON.stringify(d, null, 2))

// ── Helpers ──────────────────────────────────────────────────────────────────
function setDesc(obj, key, desc) {
  if (obj && obj[key] !== undefined && !obj[key].description)
    obj[key].description = desc
}
function setParamDesc(params, name, desc) {
  const p = (params || []).find(x => x.name === name)
  if (p && !p.description) p.description = desc
}
function bodyProps(spec, pathStr, method) {
  return spec.paths?.[pathStr]?.[method]?.requestBody?.content?.['application/json']?.schema?.properties
}
function lineProps(spec, pathStr) {
  return bodyProps(spec, pathStr, 'post')?.lines?.items?.properties
}
function seedItemProps(spec) {
  return bodyProps(spec, '/api/account-plans/seed', 'post')?.accounts?.items?.properties
}
function params(spec, pathStr, method) {
  return spec.paths?.[pathStr]?.[method]?.parameters || spec.paths?.[pathStr]?.parameters || []
}

// ═════════════════════════════════════════════════════════════════════════════
// FLOW (PT internal)
// ═════════════════════════════════════════════════════════════════════════════
const flow = r('openapi-flow.json')
const fp = flow.paths

// Query params — company_id, date_from, date_to
for (const p of ['/api/company-members', '/api/transactions', '/api/categories',
                  '/api/banks', '/api/contacts', '/api/payables',
                  '/api/cash-flow', '/api/income-statement']) {
  setParamDesc(fp[p]?.get?.parameters, 'company_id', 'ID da empresa cujos dados serão listados.')
}
setParamDesc(fp['/api/cash-flow']?.get?.parameters,        'date_from', 'Data de início do período (YYYY-MM-DD).')
setParamDesc(fp['/api/cash-flow']?.get?.parameters,        'date_to',   'Data de fim do período (YYYY-MM-DD).')
setParamDesc(fp['/api/income-statement']?.get?.parameters, 'date_from', 'Data de início do período (YYYY-MM-DD).')
setParamDesc(fp['/api/income-statement']?.get?.parameters, 'date_to',   'Data de fim do período (YYYY-MM-DD).')
setParamDesc(fp['/api/invites/{token}']?.get?.parameters,         'token', 'Token único do convite (UUID gerado na criação).')
setParamDesc(fp['/api/invites/{token}/accept']?.post?.parameters, 'token', 'Token único do convite (UUID gerado na criação).')

// POST /api/companies body
const cPost = bodyProps(flow, '/api/companies', 'post')
if (cPost) {
  setDesc(cPost, 'name',       'Razão social da empresa.')
  setDesc(cPost, 'cnpj',       'CNPJ sem formatação (14 dígitos numéricos).')
  setDesc(cPost, 'trade_name', 'Nome fantasia.')
  setDesc(cPost, 'tax_regime', 'Regime tributário adotado pela empresa.')
  setDesc(cPost, 'segment',    'Segmento de atuação da empresa.')
}

// PATCH /api/companies/{id} body
const cPatch = bodyProps(flow, '/api/companies/{id}', 'patch')
if (cPatch) {
  setDesc(cPatch, 'name',       'Razão social da empresa.')
  setDesc(cPatch, 'cnpj',       'CNPJ sem formatação (14 dígitos numéricos).')
  setDesc(cPatch, 'trade_name', 'Nome fantasia.')
  setDesc(cPatch, 'tax_regime', 'Regime tributário adotado pela empresa.')
  setDesc(cPatch, 'segment',    'Segmento de atuação da empresa.')
}

// POST /api/company-members body
const cmPost = bodyProps(flow, '/api/company-members', 'post')
if (cmPost) {
  setDesc(cmPost, 'company_id',    'ID da empresa que está enviando o convite.')
  setDesc(cmPost, 'email',         'E-mail do colaborador convidado.')
  setDesc(cmPost, 'invite_token',  'Token UUID gerado pelo cliente — usado para construir o link de convite no e-mail.')
  setDesc(cmPost, 'language',      'Idioma do e-mail de convite.')
}

// POST /api/accountant-companies body
const acPost = bodyProps(flow, '/api/accountant-companies', 'post')
if (acPost) {
  setDesc(acPost, 'company_id',   'ID da empresa que está convidando o contador.')
  setDesc(acPost, 'email',        'E-mail do contador convidado.')
  setDesc(acPost, 'invite_token', 'Token UUID gerado pelo cliente — usado para construir o link de convite no e-mail.')
  setDesc(acPost, 'language',     'Idioma do e-mail de convite.')
}

// POST /api/categories body
const catPost = bodyProps(flow, '/api/categories', 'post')
if (catPost) {
  setDesc(catPost, 'company_id', 'ID da empresa dona da categoria.')
  setDesc(catPost, 'name',       'Nome da categoria exibido na interface.')
  setDesc(catPost, 'color',      'Cor hexadecimal da categoria (ex: #3b82f6). Opcional.')
}

// POST /api/banks body
const bkPost = bodyProps(flow, '/api/banks', 'post')
if (bkPost) {
  setDesc(bkPost, 'company_id',     'ID da empresa dona da conta bancária.')
  setDesc(bkPost, 'name',           'Nome identificador da conta (ex: Banco do Brasil — PJ).')
  setDesc(bkPost, 'account_type',   'Tipo de conta: corrente (checking) ou poupança (savings).')
  setDesc(bkPost, 'agency',         'Agência bancária.')
  setDesc(bkPost, 'account_number', 'Número da conta.')
  setDesc(bkPost, 'pix_key',        'Chave PIX associada à conta.')
}

// PATCH /api/banks/{id} body
const bkPatch = bodyProps(flow, '/api/banks/{id}', 'patch')
if (bkPatch) {
  setDesc(bkPatch, 'name',         'Nome identificador da conta.')
  setDesc(bkPatch, 'account_type', 'Tipo de conta: corrente (checking) ou poupança (savings).')
}

// POST /api/contacts body
const ctPost = bodyProps(flow, '/api/contacts', 'post')
if (ctPost) {
  setDesc(ctPost, 'company_id', 'ID da empresa dona do contato.')
  setDesc(ctPost, 'name',       'Nome do cliente ou fornecedor.')
  setDesc(ctPost, 'cpf',        'CPF sem formatação (11 dígitos numéricos).')
  setDesc(ctPost, 'cnpj',       'CNPJ sem formatação (14 dígitos numéricos).')
}

// PATCH /api/contacts/{id}
const ctPatch = bodyProps(flow, '/api/contacts/{id}', 'patch')
if (ctPatch) {
  setDesc(ctPatch, 'name', 'Nome do cliente ou fornecedor.')
  setDesc(ctPatch, 'cpf',  'CPF sem formatação (11 dígitos numéricos). Enviar null para remover.')
  setDesc(ctPatch, 'cnpj', 'CNPJ sem formatação (14 dígitos numéricos). Enviar null para remover.')
}

// POST /api/payables body
const pyPost = bodyProps(flow, '/api/payables', 'post')
if (pyPost) {
  setDesc(pyPost, 'company_id',   'ID da empresa dona do compromisso.')
  setDesc(pyPost, 'description',  'Descrição do compromisso financeiro.')
  setDesc(pyPost, 'amount',       'Valor em reais.')
  setDesc(pyPost, 'type',         'Tipo: payable = a pagar; receivable = a receber.')
  setDesc(pyPost, 'due_date',     'Data de vencimento.')
  setDesc(pyPost, 'contact_name', 'Nome do fornecedor ou cliente.')
  setDesc(pyPost, 'notes',        'Observações livres.')
}

// PATCH /api/payables/{id}
const pyPatch = bodyProps(flow, '/api/payables/{id}', 'patch')
if (pyPatch) {
  setDesc(pyPatch, 'description',  'Descrição do compromisso financeiro.')
  setDesc(pyPatch, 'amount',       'Valor em reais.')
  setDesc(pyPatch, 'due_date',     'Data de vencimento.')
  setDesc(pyPatch, 'paid_date',    'Data efetiva do pagamento/recebimento.')
  setDesc(pyPatch, 'status',       'Status atual do compromisso.')
  setDesc(pyPatch, 'contact_name', 'Nome do fornecedor ou cliente.')
  setDesc(pyPatch, 'notes',        'Observações livres.')
}

// PATCH /api/transactions/{id}
const txPatch = bodyProps(flow, '/api/transactions/{id}', 'patch')
if (txPatch) {
  setDesc(txPatch, 'description',          'Descrição do lançamento.')
  setDesc(txPatch, 'amount',               'Valor em reais.')
  setDesc(txPatch, 'date',                 'Data de competência (YYYY-MM-DD).')
  setDesc(txPatch, 'paid_at',              'Data efetiva do pagamento/recebimento (YYYY-MM-DD).')
  setDesc(txPatch, 'notes',                'Observações livres.')
  setDesc(txPatch, 'category_id',          'Categoria do lançamento. Enviar null para remover.')
  setDesc(txPatch, 'contact_id',           'Contato vinculado. Enviar null para remover.')
  setDesc(txPatch, 'bank_id',              'Conta bancária usada. Enviar null para remover.')
  setDesc(txPatch, 'payment_method',       'Forma de pagamento: cash (dinheiro/pix) ou bank (débito bancário).')
  setDesc(txPatch, 'installment_count',    'Total de parcelas do parcelamento.')
  setDesc(txPatch, 'installment_number',   'Número desta parcela (1, 2, 3…).')
  setDesc(txPatch, 'payment_registered_at', 'Data/hora em que o pagamento foi registrado.')
  setDesc(txPatch, 'payment_registered_by', 'ID do usuário que registrou o pagamento.')
}

w('openapi-flow.json', flow)
console.log('flow.json: ok')

// ═════════════════════════════════════════════════════════════════════════════
// BOOKS (PT internal)
// ═════════════════════════════════════════════════════════════════════════════
const books = r('openapi-books.json')
const bp = books.paths

// Query params
setParamDesc(bp['/api/transactions/counterparts']?.get?.parameters, 'ext_company_id', 'ID da empresa externa cujos counterparts serão listados.')
for (const p of ['/api/fiscal-documents', '/api/fiscal-books', '/api/tax-calculations']) {
  setParamDesc(bp[p]?.get?.parameters, 'company_id', 'ID da empresa Flow cujos documentos serão listados.')
}
setParamDesc(bp['/api/invites/{token}']?.get?.parameters,         'token', 'Token único do convite (UUID gerado na criação).')
setParamDesc(bp['/api/invites/{token}/accept']?.post?.parameters, 'token', 'Token único do convite (UUID gerado na criação).')

// POST /api/external-companies
const ecPost = bodyProps(books, '/api/external-companies', 'post')
if (ecPost) {
  setDesc(ecPost, 'name',       'Razão social da empresa externa.')
  setDesc(ecPost, 'cnpj',       'CNPJ sem formatação (14 dígitos numéricos).')
  setDesc(ecPost, 'trade_name', 'Nome fantasia.')
  setDesc(ecPost, 'tax_regime', 'Regime tributário adotado pela empresa.')
  setDesc(ecPost, 'segment',    'Segmento de atuação da empresa.')
  setDesc(ecPost, 'notes',      'Observações internas do contador.')
  setDesc(ecPost, 'seed_plan',  'Se true, cria automaticamente o Plano de Contas padrão CFC.')
}

// PATCH /api/external-companies/{id}
const ecPatch = bodyProps(books, '/api/external-companies/{id}', 'patch')
if (ecPatch) {
  setDesc(ecPatch, 'name',       'Razão social da empresa externa.')
  setDesc(ecPatch, 'cnpj',       'CNPJ sem formatação (14 dígitos numéricos).')
  setDesc(ecPatch, 'trade_name', 'Nome fantasia.')
  setDesc(ecPatch, 'tax_regime', 'Regime tributário adotado pela empresa.')
  setDesc(ecPatch, 'segment',    'Segmento de atuação da empresa.')
}

// POST /api/transactions (books)
const bTxPost = bodyProps(books, '/api/transactions', 'post')
if (bTxPost) {
  setDesc(bTxPost, 'ext_company_id', 'ID da empresa externa para qual o lançamento pertence.')
  setDesc(bTxPost, 'description',    'Descrição do lançamento financeiro.')
  setDesc(bTxPost, 'amount',         'Valor em reais (maior que zero).')
  setDesc(bTxPost, 'date',           'Data de competência (YYYY-MM-DD).')
  setDesc(bTxPost, 'is_paid',        'true = pago/recebido; false = pendente. Padrão: false.')
  setDesc(bTxPost, 'paid_at',        'Data efetiva do pagamento/recebimento (YYYY-MM-DD). Obrigatório se is_paid = true.')
  setDesc(bTxPost, 'notes',          'Observações livres sobre o lançamento.')
}

// PATCH /api/transactions/{id} (books)
const bTxPatch = bodyProps(books, '/api/transactions/{id}', 'patch')
if (bTxPatch) {
  setDesc(bTxPatch, 'description', 'Descrição do lançamento financeiro.')
  setDesc(bTxPatch, 'amount',      'Valor em reais (maior que zero).')
  setDesc(bTxPatch, 'date',        'Data de competência (YYYY-MM-DD).')
  setDesc(bTxPatch, 'paid_at',     'Data efetiva do pagamento/recebimento. Enviado null quando is_paid = false.')
  setDesc(bTxPatch, 'notes',       'Observações livres. Enviar null para remover.')
}

// POST /api/journal-entries (books)
const jePost = bodyProps(books, '/api/journal-entries', 'post')
if (jePost) {
  setDesc(jePost, 'entry_date',    'Data de competência do lançamento contábil (YYYY-MM-DD).')
  setDesc(jePost, 'description',   'Histórico descritivo do lançamento contábil.')
  setDesc(jePost, 'external_ref',  'Referência externa para rastreio (número de documento, protocolo, etc.).')
  setDesc(jePost, 'company_id',    'Empresa Flow (exclusivo com ext_company_id).')
  setDesc(jePost, 'ext_company_id','Empresa externa (exclusivo com company_id).')
}
const bJeLines = lineProps(books, '/api/journal-entries')
if (bJeLines) {
  setDesc(bJeLines, 'account_plan_id', 'ID da conta analítica no plano de contas da empresa.')
  setDesc(bJeLines, 'side',            'Lado da partida dobrada: debit (débito) ou credit (crédito).')
  setDesc(bJeLines, 'amount',          'Valor da partida em reais (maior que zero).')
  setDesc(bJeLines, 'memo',            'Histórico individual da partida (linha do lançamento).')
}

// POST /api/account-plans
const apPost = bodyProps(books, '/api/account-plans', 'post')
if (apPost) {
  setDesc(apPost, 'code',          'Código hierárquico da conta no plano (ex: 1.01.001). Único por empresa.')
  setDesc(apPost, 'name',          'Nome descritivo da conta contábil.')
  setDesc(apPost, 'is_analytic',   'true = conta analítica que recebe lançamentos; false = sintética (agrupadora). Padrão: true.')
  setDesc(apPost, 'parent_id',     'UUID da conta pai no plano hierárquico. null = conta raiz.')
  setDesc(apPost, 'company_id',    'Empresa Flow (exclusivo com ext_company_id).')
  setDesc(apPost, 'ext_company_id','Empresa externa (exclusivo com company_id).')
}

// PATCH /api/account-plans/{id}
const apPatch = bodyProps(books, '/api/account-plans/{id}', 'patch')
if (apPatch) {
  setDesc(apPatch, 'code',      'Novo código hierárquico. Deve ser único na empresa.')
  setDesc(apPatch, 'name',      'Nome descritivo da conta.')
  setDesc(apPatch, 'parent_id', 'UUID da conta pai. null = promover para conta raiz.')
}

// POST /api/account-plans/seed
const seedSchema = books.paths['/api/account-plans/seed']?.post?.requestBody?.content?.['application/json']?.schema?.properties
if (seedSchema) {
  setDesc(seedSchema, 'company_id',    'Empresa Flow (exclusivo com ext_company_id).')
  setDesc(seedSchema, 'ext_company_id','Empresa externa (exclusivo com company_id).')
}
const seedItems = seedItemProps(books)
if (seedItems) {
  setDesc(seedItems, 'code',        'Código hierárquico da conta (ex: 1.01.001).')
  setDesc(seedItems, 'name',        'Nome descritivo da conta.')
  setDesc(seedItems, 'is_analytic', 'true = analítica (recebe lançamentos); false = sintética (agrupadora).')
  setDesc(seedItems, 'parent_code', 'Código da conta pai no mesmo lote. null = conta raiz.')
}

// GET /api/journal-entries params
const jeGet = books.paths['/api/journal-entries']?.get?.parameters
if (jeGet) {
  setParamDesc(jeGet, 'company_id',    'Empresa Flow (exclusivo com ext_company_id).')
  setParamDesc(jeGet, 'ext_company_id','Empresa externa (exclusivo com company_id).')
  setParamDesc(jeGet, 'period',        'Filtra lançamentos pelo mês (YYYY-MM).')
}

// GET /api/account-plans params
const apGet = books.paths['/api/account-plans']?.get?.parameters
if (apGet) {
  setParamDesc(apGet, 'company_id',    'Empresa Flow (exclusivo com ext_company_id).')
  setParamDesc(apGet, 'ext_company_id','Empresa externa (exclusivo com company_id).')
}

// GET /api/fiscal-documents optional params
const fdGet = books.paths['/api/fiscal-documents']?.get?.parameters
if (fdGet) {
  setParamDesc(fdGet, 'doc_type',  'Filtro por tipo de documento fiscal.')
  setParamDesc(fdGet, 'date_from', 'Data de emissão inicial (YYYY-MM-DD).')
  setParamDesc(fdGet, 'date_to',   'Data de emissão final (YYYY-MM-DD).')
}

// GET /api/api-keys params
const akGet = books.paths['/api/api-keys']?.get?.parameters
if (akGet) {
  setParamDesc(akGet, 'company_id',    'Empresa Flow (exclusivo com ext_company_id).')
  setParamDesc(akGet, 'ext_company_id','Empresa externa (exclusivo com company_id).')
}

// POST /api/api-keys body
const akPost = bodyProps(books, '/api/api-keys', 'post')
if (akPost) {
  setDesc(akPost, 'name',           'Nome para identificar a API Key (ex: Integração ERP).')
  setDesc(akPost, 'company_id',     'Empresa Flow (exclusivo com ext_company_id).')
  setDesc(akPost, 'ext_company_id', 'Empresa externa (exclusivo com company_id).')
  setDesc(akPost, 'expires_at',     'Data de expiração da chave (ISO 8601). null = sem expiração.')
}

w('openapi-books.json', books)
console.log('books.json: ok')

// ═════════════════════════════════════════════════════════════════════════════
// BOOKS EXTERNAL — PT and EN
// ═════════════════════════════════════════════════════════════════════════════
function fixExternal(file, t) {
  const spec = r(file)
  const ep = spec.paths

  // GET /api/transactions params
  const getParams = ep['/api/transactions']?.get?.parameters || []
  setParamDesc(getParams, 'ext_company_id', t.ext_company_id_desc)
  setParamDesc(getParams, 'type',      t.type_filter)
  setParamDesc(getParams, 'is_paid',   t.is_paid_filter)
  setParamDesc(getParams, 'date_from', t.date_from)
  setParamDesc(getParams, 'date_to',   t.date_to)
  setParamDesc(getParams, 'page',      t.page)
  setParamDesc(getParams, 'page_size', t.page_size)

  // POST /api/transactions body
  const ptPost = bodyProps(spec, '/api/transactions', 'post')
  if (ptPost) {
    setDesc(ptPost, 'description', t.tx_description)
    setDesc(ptPost, 'amount',      t.tx_amount)
    setDesc(ptPost, 'is_paid',     t.is_paid_body)
    setDesc(ptPost, 'notes',       t.notes)
  }

  // PATCH /api/transactions/{id} body
  const ptPatch = bodyProps(spec, '/api/transactions/{id}', 'patch')
  if (ptPatch) {
    setDesc(ptPatch, 'description', t.tx_description)
    setDesc(ptPatch, 'amount',      t.tx_amount)
    setDesc(ptPatch, 'date',        t.date_body)
    setDesc(ptPatch, 'paid_at',     t.paid_at)
    setDesc(ptPatch, 'notes',       t.notes)
  }

  // POST /api/journal-entries body
  const jePost = bodyProps(spec, '/api/journal-entries', 'post')
  if (jePost) {
    setDesc(jePost, 'description',  t.je_description)
    setDesc(jePost, 'company_id',    t.company_id_excl)
    setDesc(jePost, 'ext_company_id',t.ext_company_id_excl)
  }
  const extJeLines = lineProps(spec, '/api/journal-entries')
  if (extJeLines) {
    setDesc(extJeLines, 'side',   t.side)
    setDesc(extJeLines, 'amount', t.line_amount)
  }

  w(file, spec)
  console.log(file + ': ok')
}

fixExternal('openapi-books-external.json', {
  ext_company_id_desc: 'ID da empresa externa cujos lançamentos serão listados.',
  type_filter:         'Filtro por tipo: income (receitas) ou expense (despesas).',
  is_paid_filter:      'Filtro por situação de pagamento.',
  date_from:           'Data de competência inicial (YYYY-MM-DD).',
  date_to:             'Data de competência final (YYYY-MM-DD).',
  page:                'Número da página (começa em 1).',
  page_size:           'Quantidade de registros por página. Máximo: 1.000.',
  tx_description:      'Texto descritivo do lançamento financeiro.',
  tx_amount:           'Valor em reais (maior que zero).',
  is_paid_body:        'true = pago/recebido; false = pendente. Padrão: false.',
  notes:               'Observações livres sobre o lançamento.',
  date_body:           'Data de competência (YYYY-MM-DD).',
  paid_at:             'Data efetiva do pagamento/recebimento. Enviado null quando is_paid volta a false.',
  je_description:      'Histórico descritivo do lançamento contábil.',
  company_id_excl:     'Empresa Flow (exclusivo com ext_company_id).',
  ext_company_id_excl: 'Empresa externa (exclusivo com company_id).',
  side:                'Lado da partida dobrada: debit (débito) ou credit (crédito).',
  line_amount:         'Valor da partida em reais (maior que zero).',
})

fixExternal('openapi-books-external-en.json', {
  ext_company_id_desc: 'ID of the external company whose transactions will be listed.',
  type_filter:         'Filter by type: income or expense.',
  is_paid_filter:      'Filter by payment status.',
  date_from:           'Start accrual date (YYYY-MM-DD).',
  date_to:             'End accrual date (YYYY-MM-DD).',
  page:                'Page number (starts at 1).',
  page_size:           'Number of records per page. Maximum: 1,000.',
  tx_description:      'Descriptive text for the financial transaction.',
  tx_amount:           'Amount in currency (greater than zero).',
  is_paid_body:        'true = paid/received; false = pending. Default: false.',
  notes:               'Free-form notes about the transaction.',
  date_body:           'Accrual date (YYYY-MM-DD).',
  paid_at:             'Actual payment/receipt date. Send null when is_paid returns to false.',
  je_description:      'Descriptive history of the accounting entry.',
  company_id_excl:     'Flow company (exclusive with ext_company_id).',
  ext_company_id_excl: 'External company (exclusive with company_id).',
  side:                'Side of the double entry: debit or credit.',
  line_amount:         'Line amount in currency (greater than zero).',
})
