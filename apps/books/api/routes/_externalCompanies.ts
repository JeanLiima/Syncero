import { Hono } from 'hono'
import { createServiceClient, type HonoVariables } from '../_shared'
import { DEFAULT_ACCOUNT_PLAN } from '../_defaultAccountPlan'

const router = new Hono<{ Variables: HonoVariables }>()

// ── GET /api/external-companies ────────────────────────────────
router.get('/', async (c) => {
  const userId = c.get('userId')
  const db = createServiceClient()

  const { data, error } = await db.from('external_companies')
    .select('*')
    .eq('accountant_id', userId)
    .eq('is_active', true)
    .order('created_at', { ascending: false })
  if (error) return c.json({ error: 'internal_error' }, 500)
  return c.json(data ?? [])
})

// ── POST /api/external-companies ───────────────────────────────
router.post('/', async (c) => {
  const userId = c.get('userId')
  const db = createServiceClient()
  const body = await c.req.json<{
    name: string; cnpj?: string | null; trade_name?: string | null
    tax_regime?: string | null; integration?: string; segment?: string | null
    notes?: string | null; seed_plan?: boolean
  }>()

  if (!body.name?.trim()) return c.json({ error: 'name_required' }, 400)

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
  if (insertErr) return c.json({ error: 'internal_error' }, 500)

  if (body.seed_plan && company) {
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

// ── GET /api/external-companies/:id ────────────────────────────
router.get('/:id', async (c) => {
  const userId = c.get('userId')
  const db = createServiceClient()
  const { id } = c.req.param()

  const { data, error } = await db.from('external_companies')
    .select('*').eq('id', id).eq('accountant_id', userId).maybeSingle()
  if (error) return c.json({ error: error.message }, 400)
  if (!data) return c.json({ error: 'forbidden' }, 403)
  return c.json(data)
})

// ── PATCH /api/external-companies/:id ─────────────────────────
router.patch('/:id', async (c) => {
  const userId = c.get('userId')
  const db = createServiceClient()
  const { id } = c.req.param()

  const { data: existing } = await db.from('external_companies')
    .select('accountant_id').eq('id', id).maybeSingle()
  if (!existing || existing.accountant_id !== userId) return c.json({ error: 'forbidden' }, 403)

  const body = await c.req.json<{
    name?: string; cnpj?: string | null; trade_name?: string | null
    tax_regime?: string | null; segment?: string | null; iss_rate?: number | null
  }>()

  const updates: Record<string, unknown> = {}
  if (body.name        !== undefined) updates.name        = body.name
  if (body.cnpj        !== undefined) updates.cnpj        = body.cnpj
  if (body.trade_name  !== undefined) updates.trade_name  = body.trade_name
  if (body.tax_regime  !== undefined) updates.tax_regime  = body.tax_regime
  if (body.segment     !== undefined) updates.segment     = body.segment
  if (body.iss_rate    !== undefined) updates.iss_rate    = body.iss_rate

  if (Object.keys(updates).length === 0) return c.json({ error: 'no_changes' }, 400)

  const { data, error } = await db.from('external_companies')
    .update(updates).eq('id', id).select('*').single()
  if (error) return c.json({ error: 'internal_error' }, 500)
  return c.json(data)
})

// ── GET /api/external-companies/:id/summary ───────────────────

router.get('/:id/summary', async (c) => {
  const userId = c.get('userId')
  const db = createServiceClient()
  const { id } = c.req.param()

  const { data: ec } = await db.from('external_companies')
    .select('id').eq('id', id).eq('accountant_id', userId).maybeSingle()
  if (!ec) return c.json({ error: 'forbidden' }, 403)

  const [txs, entries, nfe, books, taxes] = await Promise.all([
    db.from('transactions').select('id', { count: 'exact', head: true }).eq('ext_company_id', id),
    db.from('journal_entries').select('id', { count: 'exact', head: true }).eq('ext_company_id', id),
    db.from('fiscal_documents').select('id', { count: 'exact', head: true }).eq('ext_company_id', id),
    db.from('fiscal_books').select('id', { count: 'exact', head: true }).eq('ext_company_id', id),
    db.from('tax_calculations').select('tax_amount').eq('ext_company_id', id).neq('status', 'paid'),
  ])

  const taxTotal = taxes.data?.reduce((s, t) => s + ((t.tax_amount as number) ?? 0), 0) ?? 0

  return c.json({
    txCount: txs.count ?? 0,
    entryCount: entries.count ?? 0,
    nfeCount: nfe.count ?? 0,
    booksCount: books.count ?? 0,
    taxTotal,
  })
})

export default router
