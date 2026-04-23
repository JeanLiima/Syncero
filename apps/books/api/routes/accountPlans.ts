import { Hono } from 'hono'
import { createServiceClient, type HonoVariables } from '../_shared'

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

export default router
