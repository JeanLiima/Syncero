import { Hono } from 'hono'
import { createServiceClient, type HonoVariables } from '../_shared'
import { DEFAULT_ACCOUNT_PLAN } from '../defaultAccountPlan'

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
  if (error) return c.json({ error: error.message }, 400)
  return c.json(data ?? [])
})

// ── POST /api/external-companies ───────────────────────────────
router.post('/', async (c) => {
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
    tax_regime?: string | null; segment?: string | null
  }>()

  const { data, error } = await db.from('external_companies')
    .update(body).eq('id', id).select('*').single()
  if (error) return c.json({ error: error.message }, 400)
  return c.json(data)
})

export default router
