import { Hono } from 'hono'
import { createServiceClient, type HonoVariables } from '../_shared'
import { DEFAULT_ACCOUNT_PLAN } from '../defaultAccountPlan'

const router = new Hono<{ Variables: HonoVariables }>()

// ── GET /api/account-plans ────────────────────────────────────
router.get('/', async (c) => {
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
router.post('/', async (c) => {
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
router.patch('/:id', async (c) => {
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

// ── GET /api/account-plans/:id/usage ─────────────────────────
router.get('/:id/usage', async (c) => {
  const userId = c.get('userId')
  const db = createServiceClient()
  const { id } = c.req.param()

  const { data: existing } = await db.from('account_plans')
    .select('accountant_id').eq('id', id).maybeSingle()
  if (!existing || existing.accountant_id !== userId) return c.json({ error: 'forbidden' }, 403)

  const { count } = await db.from('journal_entry_lines')
    .select('id', { count: 'exact', head: true })
    .eq('account_plan_id', id)

  return c.json({ usageCount: count ?? 0 })
})

// ── DELETE /api/account-plans/:id ────────────────────────────
router.delete('/:id', async (c) => {
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

// ── POST /api/account-plans/:id/transfer ──────────────────────
// Move all journal_entry_lines from one account to another, then delete
router.post('/:id/transfer', async (c) => {
  const userId = c.get('userId')
  const db = createServiceClient()
  const { id } = c.req.param()
  const { targetId } = await c.req.json<{ targetId: string }>()

  if (!targetId) return c.json({ error: 'targetId required' }, 400)

  const { data: existing } = await db.from('account_plans')
    .select('accountant_id').eq('id', id).maybeSingle()
  if (!existing || existing.accountant_id !== userId) return c.json({ error: 'forbidden' }, 403)

  const { data: target } = await db.from('account_plans')
    .select('accountant_id, is_analytic').eq('id', targetId).maybeSingle()
  if (!target || target.accountant_id !== userId) return c.json({ error: 'target forbidden' }, 403)
  if (!target.is_analytic) return c.json({ error: 'target must be analytic' }, 400)

  const { error: updateErr } = await db.from('journal_entry_lines')
    .update({ account_plan_id: targetId })
    .eq('account_plan_id', id)
  if (updateErr) return c.json({ error: updateErr.message }, 500)

  const { error: deleteErr } = await db.from('account_plans').update({ is_active: false }).eq('id', id)
  if (deleteErr) return c.json({ error: deleteErr.message }, 500)

  return c.json({ ok: true })
})

// ── POST /api/account-plans/seed ─────────────────────────────
router.post('/seed', async (c) => {
  const userId = c.get('userId')
  const db = createServiceClient()
  const { companyId, extCompanyId } = await c.req.json<{ companyId?: string; extCompanyId?: string }>()

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

  const codeToId = new Map<string, string>()
  for (const account of DEFAULT_ACCOUNT_PLAN) {
    const parentId = account.parent_code ? (codeToId.get(account.parent_code) ?? null) : null
    const { data: row } = await db.from('account_plans').insert({
      ...(extCompanyId ? { ext_company_id: extCompanyId } : { company_id: companyId }),
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

  return c.json({ seeded: codeToId.size }, 201)
})

export default router
