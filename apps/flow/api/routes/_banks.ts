import { Hono } from 'hono'
import { createServiceClient, ensureCompanyMember, type HonoVariables } from '../_shared'

const router = new Hono<{ Variables: HonoVariables }>()

router.get('/', async (c) => {
  const userId = c.get('userId')
  const db = createServiceClient()
  const companyId = c.req.query('company_id')
  if (!companyId) return c.json({ error: 'company_id_required' }, 400)

  const member = await ensureCompanyMember(db, userId, companyId)
  if (!member) return c.json({ error: 'forbidden' }, 403)

  const { data, error } = await db.from('banks').select('*').eq('company_id', companyId).order('name')
  if (error) return c.json({ error: 'internal_error' }, 500)
  return c.json(data)
})

router.post('/', async (c) => {
  const userId = c.get('userId')
  const db = createServiceClient()
  const body = await c.req.json<{ company_id?: string; name?: string; account_type?: string }>()
  const { company_id: companyId, name, account_type } = body
  if (!companyId) return c.json({ error: 'company_id_required' }, 400)

  const member = await ensureCompanyMember(db, userId, companyId)
  if (!member) return c.json({ error: 'forbidden' }, 403)

  const { data, error } = await db.from('banks').insert({
    company_id:   companyId,
    name:         name ?? '',
    account_type: account_type ?? 'checking',
  }).select().single()
  if (error) return c.json({ error: 'internal_error' }, 500)
  return c.json(data, 201)
})

router.patch('/:id', async (c) => {
  const userId = c.get('userId')
  const db = createServiceClient()
  const bankId = c.req.param('id')
  const payload = await c.req.json<{ name?: string; account_type?: string }>()

  const row = await db.from('banks').select('company_id').eq('id', bankId).single()
  if (!row.data) return c.json({ error: 'not_found' }, 404)

  const member = await ensureCompanyMember(db, userId, row.data.company_id)
  if (!member) return c.json({ error: 'forbidden' }, 403)

  const allowed: Record<string, unknown> = {}
  if (payload.name         !== undefined) allowed.name         = payload.name
  if (payload.account_type !== undefined) allowed.account_type = payload.account_type
  if (Object.keys(allowed).length === 0) return c.json({ error: 'no_changes' }, 400)

  const { data, error } = await db.from('banks').update(allowed).eq('id', bankId).select().single()
  if (error) return c.json({ error: 'internal_error' }, 500)
  return c.json(data)
})

router.delete('/:id', async (c) => {
  const userId = c.get('userId')
  const db = createServiceClient()
  const bankId = c.req.param('id')

  const row = await db.from('banks').select('company_id').eq('id', bankId).single()
  if (!row.data) return c.json({ error: 'not_found' }, 404)

  const member = await ensureCompanyMember(db, userId, row.data.company_id)
  if (!member) return c.json({ error: 'forbidden' }, 403)

  const { error } = await db.from('banks').delete().eq('id', bankId)
  if (error) return c.json({ error: 'internal_error' }, 500)
  return c.json({ ok: true })
})

export default router
