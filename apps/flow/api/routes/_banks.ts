import { Hono } from 'hono'
import { createServiceClient, type HonoVariables } from '../_shared'

const router = new Hono<{ Variables: HonoVariables }>()

async function ensureCompanyMember(db: ReturnType<typeof createServiceClient>, userId: string, companyId: string) {
  const { data } = await db.from('company_members')
    .select('id').eq('user_id', userId).eq('company_id', companyId).eq('status', 'accepted').maybeSingle()
  return data
}

router.get('/', async (c) => {
  const userId = c.get('userId')
  const db = createServiceClient()
  const companyId = c.req.query('company_id')
  if (!companyId) return c.json({ error: 'company_id required' }, 400)

  const member = await ensureCompanyMember(db, userId, companyId)
  if (!member) return c.json({ error: 'forbidden' }, 403)

  const { data, error } = await db.from('banks').select('*').eq('company_id', companyId).order('name')
  if (error) return c.json({ error: error.message }, 400)
  return c.json(data)
})

router.post('/', async (c) => {
  const userId = c.get('userId')
  const db = createServiceClient()
  const body = await c.req.json<Record<string, unknown>>()
  const companyId = body.company_id as string | undefined
  if (!companyId) return c.json({ error: 'company_id required' }, 400)

  const member = await ensureCompanyMember(db, userId, companyId)
  if (!member) return c.json({ error: 'forbidden' }, 403)

  const b = body as Record<string, unknown>
  const { data, error } = await db.from('banks').insert({
    company_id:   companyId,
    name:         b.name as string,
    account_type: (b.account_type as string) ?? 'checking',
  }).select().single()
  if (error) return c.json({ error: error.message }, 400)
  return c.json(data, 201)
})

router.patch('/:id', async (c) => {
  const userId = c.get('userId')
  const db = createServiceClient()
  const bankId = c.req.param('id')
  const payload = await c.req.json<Record<string, unknown>>()

  const row = await db.from('banks').select('company_id').eq('id', bankId).single()
  if (!row.data) return c.json({ error: 'not found' }, 404)

  const member = await ensureCompanyMember(db, userId, row.data.company_id)
  if (!member) return c.json({ error: 'forbidden' }, 403)

  const p = payload as Record<string, unknown>
  const allowed: Record<string, unknown> = {}
  if (p.name         !== undefined) allowed.name         = p.name
  if (p.account_type !== undefined) allowed.account_type = p.account_type
  if (Object.keys(allowed).length === 0) return c.json({ error: 'No valid fields to update' }, 400)

  const { data, error } = await db.from('banks').update(allowed).eq('id', bankId).select().single()
  if (error) return c.json({ error: error.message }, 400)
  return c.json(data)
})

router.delete('/:id', async (c) => {
  const userId = c.get('userId')
  const db = createServiceClient()
  const bankId = c.req.param('id')

  const row = await db.from('banks').select('company_id').eq('id', bankId).single()
  if (!row.data) return c.json({ error: 'not found' }, 404)

  const member = await ensureCompanyMember(db, userId, row.data.company_id)
  if (!member) return c.json({ error: 'forbidden' }, 403)

  const { error } = await db.from('banks').delete().eq('id', bankId)
  if (error) return c.json({ error: error.message }, 400)
  return c.json({ ok: true })
})

export default router
