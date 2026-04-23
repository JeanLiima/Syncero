import { Hono } from 'hono'
import { handle } from 'hono/vercel'
import { authMiddleware, createServiceClient, type HonoVariables } from '@syncero/api'
import { DEFAULT_ACCOUNT_PLAN } from './defaultAccountPlan'

export const config = { runtime: 'edge' }

const app = new Hono<{ Variables: HonoVariables }>().basePath('/api')

app.onError((err, c) => {
  console.error(err)
  return c.json({ error: 'Internal server error' }, 500)
})

app.use('/me', authMiddleware)
app.use('/me/*', authMiddleware)
app.use('/companies/*', authMiddleware)
app.use('/external-companies/*', authMiddleware)
app.use('/account-plans', authMiddleware)
app.use('/account-plans/*', authMiddleware)
app.use('/journal-entries', authMiddleware)
app.use('/journal-entries/*', authMiddleware)
app.use('/api-keys', authMiddleware)
app.use('/api-keys/*', authMiddleware)

// ── helpers ───────────────────────────────────────────────────
async function sha256hex(text: string): Promise<string> {
  const encoded = new TextEncoder().encode(text)
  const hash = await crypto.subtle.digest('SHA-256', encoded)
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('')
}

function generateRawKey(): string {
  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  return 'sk_' + Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('')
}

// ── GET /api/me ───────────────────────────────────────────────
app.get('/me', async (c) => {
  const userId = c.get('userId')
  const db = createServiceClient()
  const { data } = await db.from('profiles')
    .select('id, full_name, email, user_type, avatar_url')
    .eq('id', userId)
    .single()
  return c.json({ profile: data })
})

// ── POST /api/me ──────────────────────────────────────────────
app.post('/me', async (c) => {
  const userId = c.get('userId')
  const db = createServiceClient()
  const { user_type } = await c.req.json<{ user_type: string }>()

  const { data: { user } } = await db.auth.admin.getUserById(userId)
  const fullName = user?.user_metadata?.full_name ?? user?.user_metadata?.name ?? user?.email?.split('@')[0] ?? 'Usuário'
  const avatarUrl = (user?.user_metadata?.avatar_url ?? user?.user_metadata?.picture ?? null) as string | null

  const { error } = await db.from('profiles').upsert(
    { id: userId, full_name: fullName, email: user?.email ?? '', user_type, avatar_url: avatarUrl },
    { onConflict: 'id' }
  )
  if (error) return c.json({ error: error.message }, 400)

  const { data: profile } = await db.from('profiles')
    .select('id, full_name, email, user_type, avatar_url')
    .eq('id', userId)
    .single()
  return c.json({ profile })
})

// ── GET /api/companies ────────────────────────────────────────
app.get('/companies', async (c) => {
  const userId = c.get('userId')
  const db = createServiceClient()

  const { data, error } = await db.from('accountant_companies')
    .select('*, companies(id, name, cnpj, tax_regime)')
    .eq('accountant_id', userId)
    .eq('status', 'accepted')
    .order('accepted_at', { ascending: false })
  if (error) return c.json({ error: error.message }, 400)
  return c.json(data ?? [])
})

// ── GET /api/companies/:id ────────────────────────────────────
app.get('/companies/:id', async (c) => {
  const userId = c.get('userId')
  const db = createServiceClient()
  const { id } = c.req.param()

  const { data: acct } = await db.from('accountant_companies')
    .select('id').eq('accountant_id', userId).eq('company_id', id).eq('status', 'accepted').maybeSingle()
  if (!acct) return c.json({ error: 'forbidden' }, 403)

  const { data } = await db.from('companies').select('id, name, cnpj, tax_regime').eq('id', id).single()
  return c.json(data)
})

// ── GET /api/companies/:id/fiscal-summary ─────────────────────
app.get('/companies/:id/fiscal-summary', async (c) => {
  const userId = c.get('userId')
  const db = createServiceClient()
  const { id } = c.req.param()

  const { data: acct } = await db.from('accountant_companies')
    .select('id').eq('accountant_id', userId).eq('company_id', id).eq('status', 'accepted').maybeSingle()
  if (!acct) return c.json({ error: 'forbidden' }, 403)

  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const period = `${year}-${month}`

  const [nfe, books, taxes] = await Promise.all([
    db.from('fiscal_documents').select('id', { count: 'exact', head: true }).eq('company_id', id),
    db.from('fiscal_books').select('id', { count: 'exact', head: true }).eq('company_id', id),
    db.from('tax_calculations').select('tax_value').eq('company_id', id)
      .gte('reference_period', period).lte('reference_period', period),
  ])

  const taxTotal = taxes.data?.reduce((s, t) => s + (t.tax_value as number), 0) ?? 0
  return c.json({ nfeCount: nfe.count ?? 0, booksCount: books.count ?? 0, taxTotal })
})

// ── GET /api/external-companies ───────────────────────────────
app.get('/external-companies', async (c) => {
  const userId = c.get('userId')
  const db = createServiceClient()

  const { data, error } = await db.from('external_companies')
    .select('*')
    .eq('accountant_id', userId)
    .eq('is_active', true)
    .order('created_at', { ascending: false })
  if (error) return c.json({ error: error.message }, 400)
  return c.json(data ?? [])
})

// ── POST /api/external-companies ──────────────────────────────
app.post('/external-companies', async (c) => {
  const userId = c.get('userId')
  const db = createServiceClient()
  const body = await c.req.json<{
    name: string; cnpj?: string | null; trade_name?: string | null
    tax_regime?: string | null; integration?: string; segment?: string | null
    notes?: string | null; seedPlan?: boolean
  }>()

  if (!body.name?.trim()) return c.json({ error: 'Nome é obrigatório' }, 400)

  const { data: company, error: insertErr } = await db.from('external_companies')
    .insert({
      accountant_id: userId,
      name: body.name.trim(),
      cnpj: body.cnpj || null,
      trade_name: body.trade_name || null,
      tax_regime: body.tax_regime || null,
      integration: body.integration ?? 'manual',
      segment: body.segment || null,
      notes: body.notes || null,
    })
    .select('id')
    .single()
  if (insertErr) return c.json({ error: insertErr.message }, 400)

  if (body.seedPlan && company) {
    const codeToId = new Map<string, string>()
    for (const account of DEFAULT_ACCOUNT_PLAN) {
      const parentId = account.parent_code ? (codeToId.get(account.parent_code) ?? null) : null
      const { data: row } = await db.from('account_plans').insert({
        ext_company_id: company.id,
        accountant_id: userId,
        parent_id: parentId,
        code: account.code,
        name: account.name,
        account_type: account.account_type,
        nature: account.nature,
        is_analytic: account.is_analytic,
      }).select('id').single()
      if (row) codeToId.set(account.code, row.id)
    }
  }

  return c.json(company, 201)
})

// ── GET /api/external-companies/:id ───────────────────────────
app.get('/external-companies/:id', async (c) => {
  const userId = c.get('userId')
  const db = createServiceClient()
  const { id } = c.req.param()

  const { data, error } = await db.from('external_companies')
    .select('*').eq('id', id).eq('accountant_id', userId).maybeSingle()
  if (error) return c.json({ error: error.message }, 400)
  if (!data) return c.json({ error: 'forbidden' }, 403)
  return c.json(data)
})

// ── GET /api/account-plans ────────────────────────────────────
app.get('/account-plans', async (c) => {
  const userId = c.get('userId')
  const db = createServiceClient()
  const { companyId, extCompanyId } = c.req.query()

  if (!companyId && !extCompanyId) return c.json({ error: 'companyId or extCompanyId required' }, 400)

  if (companyId) {
    const { data: acct } = await db.from('accountant_companies')
      .select('id').eq('accountant_id', userId).eq('company_id', companyId).eq('status', 'accepted').maybeSingle()
    if (!acct) return c.json({ error: 'forbidden' }, 403)
  } else {
    const { data: ec } = await db.from('external_companies')
      .select('id').eq('id', extCompanyId!).eq('accountant_id', userId).maybeSingle()
    if (!ec) return c.json({ error: 'forbidden' }, 403)
  }

  const q = db.from('account_plans').select('*').eq('is_active', true).order('code')
  const { data, error } = companyId
    ? await q.eq('company_id', companyId)
    : await q.eq('ext_company_id', extCompanyId!)
  if (error) return c.json({ error: error.message }, 400)
  return c.json(data ?? [])
})

// ── POST /api/account-plans ───────────────────────────────────
app.post('/account-plans', async (c) => {
  const userId = c.get('userId')
  const db = createServiceClient()
  const body = await c.req.json<{
    code: string; name: string; account_type: string; nature: string
    is_analytic: boolean; parent_id: string | null
    companyId?: string; extCompanyId?: string
  }>()

  const payload = {
    code: body.code,
    name: body.name,
    account_type: body.account_type,
    nature: body.nature,
    is_analytic: body.is_analytic,
    parent_id: body.parent_id,
    accountant_id: userId,
    ...(body.extCompanyId ? { ext_company_id: body.extCompanyId } : { company_id: body.companyId }),
  }

  const { data, error } = await db.from('account_plans').insert(payload).select('*').single()
  if (error) return c.json({ error: error.message }, 400)
  return c.json(data, 201)
})

// ── PATCH /api/account-plans/:id ─────────────────────────────
app.patch('/account-plans/:id', async (c) => {
  const userId = c.get('userId')
  const db = createServiceClient()
  const { id } = c.req.param()
  const body = await c.req.json<{
    code?: string; name?: string; account_type?: string; nature?: string
    is_analytic?: boolean; parent_id?: string | null
  }>()

  const { data: existing } = await db.from('account_plans')
    .select('accountant_id').eq('id', id).maybeSingle()
  if (!existing || existing.accountant_id !== userId) return c.json({ error: 'forbidden' }, 403)

  const { data, error } = await db.from('account_plans').update(body).eq('id', id).select('*').single()
  if (error) return c.json({ error: error.message }, 400)
  return c.json(data)
})

// ── DELETE /api/account-plans/:id ────────────────────────────
app.delete('/account-plans/:id', async (c) => {
  const userId = c.get('userId')
  const db = createServiceClient()
  const { id } = c.req.param()

  const { data: existing } = await db.from('account_plans')
    .select('accountant_id').eq('id', id).maybeSingle()
  if (!existing || existing.accountant_id !== userId) return c.json({ error: 'forbidden' }, 403)

  const { error } = await db.from('account_plans').update({ is_active: false }).eq('id', id)
  if (error) return c.json({ error: error.message }, 400)
  return c.json({ ok: true })
})

// ── GET /api/journal-entries ──────────────────────────────────
app.get('/journal-entries', async (c) => {
  const userId = c.get('userId')
  const db = createServiceClient()
  const { companyId, extCompanyId, period } = c.req.query()

  if (!companyId && !extCompanyId) return c.json({ error: 'companyId or extCompanyId required' }, 400)

  if (companyId) {
    const { data: acct } = await db.from('accountant_companies')
      .select('id').eq('accountant_id', userId).eq('company_id', companyId).eq('status', 'accepted').maybeSingle()
    if (!acct) return c.json({ error: 'forbidden' }, 403)
  } else {
    const { data: ec } = await db.from('external_companies')
      .select('id').eq('id', extCompanyId!).eq('accountant_id', userId).maybeSingle()
    if (!ec) return c.json({ error: 'forbidden' }, 403)
  }

  const dateFrom = period ? `${period}-01` : undefined
  const dateTo   = period ? `${period}-31` : undefined

  let q = db.from('journal_entries')
    .select('*, journal_entry_lines(*, account_plans(code, name))')
    .order('entry_date', { ascending: false })
  if (companyId) q = q.eq('company_id', companyId)
  else q = q.eq('ext_company_id', extCompanyId!)
  if (dateFrom) q = q.gte('entry_date', dateFrom).lte('entry_date', dateTo!)

  const { data, error } = await q
  if (error) return c.json({ error: error.message }, 400)
  return c.json(data ?? [])
})

// ── POST /api/journal-entries ─────────────────────────────────
app.post('/journal-entries', async (c) => {
  const userId = c.get('userId')
  const db = createServiceClient()
  const body = await c.req.json<{
    entry_date: string; description: string; external_ref?: string
    lines: Array<{ account_plan_id: string; side: 'debit' | 'credit'; amount: number; memo?: string }>
    companyId?: string; extCompanyId?: string
  }>()

  const { data: entry, error } = await db.from('journal_entries').insert({
    ...(body.extCompanyId ? { ext_company_id: body.extCompanyId } : { company_id: body.companyId }),
    accountant_id: userId,
    entry_date: body.entry_date,
    description: body.description,
    external_ref: body.external_ref || null,
    source: 'manual',
  }).select('id').single()
  if (error) return c.json({ error: error.message }, 400)

  const { error: linesErr } = await db.from('journal_entry_lines').insert(
    body.lines.map(l => ({
      entry_id: entry.id,
      account_plan_id: l.account_plan_id,
      side: l.side,
      amount: l.amount,
      memo: l.memo || null,
    }))
  )
  if (linesErr) return c.json({ error: linesErr.message }, 400)
  return c.json({ id: entry.id }, 201)
})

// ── POST /api/journal-entries/import ─────────────────────────
app.post('/journal-entries/import', async (c) => {
  const userId = c.get('userId')
  const db = createServiceClient()
  const body = await c.req.json<{
    entries: Array<{
      entry_date: string; description: string; external_ref?: string
      lines: Array<{ account_code: string; side: 'debit' | 'credit'; amount: number; memo?: string }>
    }>
    companyId?: string; extCompanyId?: string
  }>()

  const accountsQ = db.from('account_plans').select('id, code').eq('is_active', true)
  const { data: accountsData } = body.extCompanyId
    ? await accountsQ.eq('ext_company_id', body.extCompanyId)
    : await accountsQ.eq('company_id', body.companyId!)
  const codeToId = new Map((accountsData ?? []).map(a => [a.code, a.id]))

  const inserted: string[] = []
  for (const pe of body.entries) {
    const { data: entry, error } = await db.from('journal_entries').insert({
      ...(body.extCompanyId ? { ext_company_id: body.extCompanyId } : { company_id: body.companyId }),
      accountant_id: userId,
      entry_date: pe.entry_date,
      description: pe.description,
      external_ref: pe.external_ref || null,
      source: 'dominio_import',
    }).select('id').single()
    if (error) return c.json({ error: error.message }, 400)

    const lines = pe.lines
      .filter(l => codeToId.has(l.account_code))
      .map(l => ({
        entry_id: entry.id,
        account_plan_id: codeToId.get(l.account_code)!,
        side: l.side,
        amount: l.amount,
        memo: l.memo || null,
      }))
    if (lines.length) await db.from('journal_entry_lines').insert(lines)
    inserted.push(entry.id)
  }

  return c.json({ inserted: inserted.length }, 201)
})

// ── GET /api/api-keys ─────────────────────────────────────────
app.get('/api-keys', async (c) => {
  const userId = c.get('userId')
  const db = createServiceClient()
  const { companyId, extCompanyId } = c.req.query()

  if (!companyId && !extCompanyId) return c.json({ error: 'companyId or extCompanyId required' }, 400)

  const q = db.from('api_keys')
    .select('*')
    .eq('accountant_id', userId)
    .order('created_at', { ascending: false })
  const { data, error } = companyId
    ? await q.eq('company_id', companyId)
    : await q.eq('ext_company_id', extCompanyId!)
  if (error) return c.json({ error: error.message }, 400)
  return c.json(data ?? [])
})

// ── POST /api/api-keys ────────────────────────────────────────
app.post('/api-keys', async (c) => {
  const userId = c.get('userId')
  const db = createServiceClient()
  const body = await c.req.json<{
    name: string; expiresAt?: string | null
    companyId?: string; extCompanyId?: string
  }>()

  const rawKey = generateRawKey()
  const hash = await sha256hex(rawKey)
  const prefix = rawKey.slice(0, 11)

  const { error } = await db.from('api_keys').insert({
    accountant_id: userId,
    name: body.name,
    company_id: body.extCompanyId ? null : (body.companyId ?? null),
    ext_company_id: body.extCompanyId ?? null,
    key_hash: hash,
    key_prefix: prefix,
    expires_at: body.expiresAt ?? null,
  })
  if (error) return c.json({ error: error.message }, 400)
  return c.json({ key: rawKey }, 201)
})

// ── PATCH /api/api-keys/:id/revoke ────────────────────────────
app.patch('/api-keys/:id/revoke', async (c) => {
  const userId = c.get('userId')
  const db = createServiceClient()
  const { id } = c.req.param()

  const { data: existing } = await db.from('api_keys')
    .select('accountant_id').eq('id', id).maybeSingle()
  if (!existing || existing.accountant_id !== userId) return c.json({ error: 'forbidden' }, 403)

  const { error } = await db.from('api_keys').update({ is_active: false }).eq('id', id)
  if (error) return c.json({ error: error.message }, 400)
  return c.json({ ok: true })
})

export default handle(app)
