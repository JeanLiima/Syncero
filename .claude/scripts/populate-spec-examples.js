const fs = require('fs')
const path = require('path')

const SPECS_DIR = path.join(__dirname, '..', 'apps', 'docs', 'public')
const UUID = '550e8400-e29b-41d4-a716-446655440000'
const UUID2 = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'

function setEx(obj, field, ex) {
  if (obj?.properties?.[field] && obj.properties[field].example === undefined)
    obj.properties[field].example = ex
}
function setParamEx(params, name, ex) {
  const p = params?.find(p => p.name === name)
  if (p && p.schema && p.schema.example === undefined) p.schema.example = ex
}
function read(f) { return JSON.parse(fs.readFileSync(path.join(SPECS_DIR, f), 'utf8')) }
function write(f, data) { fs.writeFileSync(path.join(SPECS_DIR, f), JSON.stringify(data, null, 2)) }

// ── openapi-flow.json (PT) ─────────────────────────────────────
const flow = read('openapi-flow.json')
const fp = flow.paths

const txIn = flow.components.schemas.TransactionInput.properties
txIn.company_id.example  = UUID
txIn.description.example = 'Prestação de serviços — Cliente XYZ'
txIn.amount.example      = 1500
txIn.date.example        = '2026-05-01'
txIn.counterpart.example = 'Cliente XYZ Ltda'

setEx(fp['/api/me'].post.requestBody.content['application/json'].schema, 'user_type', 'company_user')
setEx(fp['/api/companies'].post.requestBody.content['application/json'].schema, 'name', 'Empresa ABC Ltda')

const pathsWithId = [
  '/api/companies/{id}',
  '/api/company-members/{id}/role', '/api/company-members/{id}/resend', '/api/company-members/{id}',
  '/api/accountant-companies/{id}/resend', '/api/accountant-companies/{id}',
  '/api/transactions/{id}',
  '/api/categories/{id}/usage', '/api/categories/{id}',
  '/api/banks/{id}', '/api/contacts/{id}', '/api/payables/{id}',
]
pathsWithId.forEach(p => setParamEx(fp[p]?.parameters, 'id', UUID))
setParamEx(fp['/api/transactions/group/{groupId}']?.parameters, 'groupId', UUID)
setParamEx(fp['/api/invites/{token}']?.parameters, 'token', UUID)
setParamEx(fp['/api/invites/{token}/accept']?.parameters, 'token', UUID)

const queryCompanyId = [
  '/api/company-members', '/api/transactions', '/api/categories',
  '/api/banks', '/api/contacts', '/api/payables', '/api/cash-flow', '/api/income-statement',
]
queryCompanyId.forEach(p => setParamEx(fp[p]?.get?.parameters, 'company_id', UUID))
setParamEx(fp['/api/cash-flow']?.get?.parameters, 'date_from', '2026-05-01')
setParamEx(fp['/api/cash-flow']?.get?.parameters, 'date_to', '2026-05-31')
setParamEx(fp['/api/income-statement']?.get?.parameters, 'date_from', '2026-05-01')
setParamEx(fp['/api/income-statement']?.get?.parameters, 'date_to', '2026-05-31')

const cmPost = fp['/api/company-members'].post.requestBody.content['application/json'].schema
setEx(cmPost, 'company_id', UUID)
setEx(cmPost, 'email', 'colaborador@empresa.com.br')
setEx(cmPost, 'invite_token', UUID2)

const acPost = fp['/api/accountant-companies'].post.requestBody.content['application/json'].schema
setEx(acPost, 'company_id', UUID)
setEx(acPost, 'email', 'contador@escritorio.com.br')
setEx(acPost, 'invite_token', UUID2)

const catPost = fp['/api/categories'].post.requestBody.content['application/json'].schema
setEx(catPost, 'company_id', UUID)
setEx(catPost, 'name', 'Vendas de Produtos')

const bankPost = fp['/api/banks'].post.requestBody.content['application/json'].schema
setEx(bankPost, 'company_id', UUID)
setEx(bankPost, 'name', 'Banco do Brasil — Conta Corrente')
setEx(bankPost, 'account_type', 'checking')

const contactPost = fp['/api/contacts'].post.requestBody.content['application/json'].schema
setEx(contactPost, 'company_id', UUID)
setEx(contactPost, 'name', 'João Silva')

const payPost = fp['/api/payables'].post.requestBody.content['application/json'].schema
setEx(payPost, 'company_id', UUID)
setEx(payPost, 'description', 'Aluguel do escritório — maio/2026')
if (payPost.properties.amount) payPost.properties.amount.example = 3200
setEx(payPost, 'type', 'payable')
setEx(payPost, 'due_date', '2026-05-31')

write('openapi-flow.json', flow)
console.log('flow.json: ok')

// ── openapi-books.json (PT) ────────────────────────────────────
const books = read('openapi-books.json')
const bp = books.paths

setEx(bp['/api/me'].post.requestBody.content['application/json'].schema, 'user_type', 'accountant')

const booksPathsWithId = [
  '/api/companies/{id}', '/api/companies/{id}/fiscal-summary',
  '/api/external-companies/{id}',
  '/api/transactions/{id}',
  '/api/account-plans/{id}', '/api/account-plans/{id}/usage', '/api/account-plans/{id}/transfer',
  '/api/api-keys/{id}/revoke',
]
booksPathsWithId.forEach(p => setParamEx(bp[p]?.parameters, 'id', UUID))
setParamEx(bp['/api/invites/{token}']?.parameters, 'token', UUID)
setParamEx(bp['/api/invites/{token}/accept']?.parameters, 'token', UUID)
setParamEx(bp['/api/transactions/counterparts']?.get?.parameters, 'ext_company_id', UUID)
;['/api/fiscal-documents', '/api/fiscal-books', '/api/tax-calculations'].forEach(p =>
  setParamEx(bp[p]?.get?.parameters, 'company_id', UUID)
)

setEx(bp['/api/external-companies'].post.requestBody.content['application/json'].schema, 'name', 'Empresa XYZ Ltda')

const bTxPost = bp['/api/transactions'].post.requestBody.content['application/json'].schema
setEx(bTxPost, 'ext_company_id', UUID)
if (bTxPost.properties.amount) bTxPost.properties.amount.example = 1500
setEx(bTxPost, 'date', '2026-05-01')

const jePost = bp['/api/journal-entries'].post.requestBody.content['application/json'].schema.properties
if (jePost.entry_date && jePost.entry_date.example === undefined) jePost.entry_date.example = '2026-05-01'
if (jePost.description && jePost.description.example === undefined) jePost.description.example = 'Prestação de serviços — Cliente XYZ'
const jeLineItems = bp['/api/journal-entries'].post.requestBody.content['application/json'].schema.properties.lines.items.properties
if (jeLineItems.account_plan_id && jeLineItems.account_plan_id.example === undefined) jeLineItems.account_plan_id.example = UUID
if (jeLineItems.amount && jeLineItems.amount.example === undefined) jeLineItems.amount.example = 1500
if (jeLineItems.side && jeLineItems.side.example === undefined) jeLineItems.side.example = 'debit'

const apPost = bp['/api/account-plans'].post.requestBody.content['application/json'].schema
setEx(apPost, 'name', 'Caixa e Equivalentes de Caixa')
setEx(apPost, 'is_analytic', true)

const seedItems = bp['/api/account-plans/seed'].post.requestBody.content['application/json'].schema.properties.accounts.items.properties
if (seedItems.code && seedItems.code.example === undefined) seedItems.code.example = '1.01.001'
if (seedItems.name && seedItems.name.example === undefined) seedItems.name.example = 'Caixa e Equivalentes de Caixa'
if (seedItems.is_analytic && seedItems.is_analytic.example === undefined) seedItems.is_analytic.example = true

const tfPost = bp['/api/account-plans/{id}/transfer'].post.requestBody.content['application/json'].schema
setEx(tfPost, 'target_id', UUID2)

const akPost = bp['/api/api-keys'].post.requestBody.content['application/json'].schema
setEx(akPost, 'name', 'Integração ERP')

write('openapi-books.json', books)
console.log('books.json: ok')

// ── External specs ─────────────────────────────────────────────
function fixExternal(file, descExample) {
  const spec = read(file)
  const ep = spec.paths

  setParamEx(ep['/api/transactions']?.get?.parameters, 'ext_company_id', UUID)
  setParamEx(ep['/api/transactions/{id}']?.parameters, 'id', UUID)
  setEx(ep['/api/transactions'].post.requestBody.content['application/json'].schema, 'ext_company_id', UUID)

  const jeProps = ep['/api/journal-entries'].post.requestBody.content['application/json'].schema.properties
  if (jeProps.ext_company_id && jeProps.ext_company_id.example === undefined) jeProps.ext_company_id.example = UUID
  if (jeProps.entry_date && jeProps.entry_date.example === undefined) jeProps.entry_date.example = '2026-05-01'
  if (jeProps.description && jeProps.description.example === undefined) jeProps.description.example = descExample
  const jeLines = jeProps.lines.items.properties
  if (jeLines.account_plan_id && jeLines.account_plan_id.example === undefined) jeLines.account_plan_id.example = UUID
  if (jeLines.amount && jeLines.amount.example === undefined) jeLines.amount.example = 1500
  if (jeLines.side && jeLines.side.example === undefined) jeLines.side.example = 'debit'

  write(file, spec)
  console.log(file + ': ok')
}

fixExternal('openapi-books-external.json', 'Prestação de serviços — Cliente XYZ')
fixExternal('openapi-books-external-en.json', 'Service delivery — Client XYZ Ltd')
