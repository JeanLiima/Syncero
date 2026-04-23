import { Hono } from 'hono'
import { createServiceClient, type HonoVariables } from '../_shared'

const router = new Hono<{ Variables: HonoVariables }>()

async function ensureCompanyMember(db: ReturnType<typeof createServiceClient>, userId: string, companyId: string) {
  const { data } = await db.from('company_members')
    .select('id')
    .eq('user_id', userId)
    .eq('company_id', companyId)
    .eq('status', 'accepted')
    .maybeSingle()
  return data
}

router.get('/', async (c) => {
  const userId = c.get('userId')
  const db = createServiceClient()
  const companyId = c.req.query('companyId')
  if (!companyId) return c.json({ error: 'companyId é obrigatório' }, 400)

  const member = await ensureCompanyMember(db, userId, companyId)
  if (!member) return c.json({ error: 'forbidden' }, 403)

  let query = db.from('transactions')
    .select('*, categories(id, name, color)', { count: 'exact' })
    .eq('company_id', companyId)
    .order('date', { ascending: false })

  const type = c.req.query('type')
  const categoryId = c.req.query('category_id')
  const isPaid = c.req.query('is_paid')
  const dateFrom = c.req.query('date_from')
  const dateTo = c.req.query('date_to')
  const page = Number(c.req.query('page') ?? '1')
  const pageSize = Math.min(Number(c.req.query('pageSize') ?? '20'), 1000)

  if (type) query = query.eq('type', type)
  if (categoryId) query = query.eq('category_id', categoryId)
  if (isPaid === 'true') query = query.eq('is_paid', true)
  if (isPaid === 'false') query = query.eq('is_paid', false)
  if (dateFrom) query = query.gte('date', dateFrom)
  if (dateTo) query = query.lte('date', dateTo)

  query = query.range((page - 1) * pageSize, page * pageSize - 1)

  const { data, error, count } = await query
  if (error) return c.json({ error: error.message }, 400)

  return c.json({ data, count })
})

router.post('/', async (c) => {
  const userId = c.get('userId')
  const db = createServiceClient()
  const body = await c.req.json<Record<string, unknown>>()
  const companyId = body.company_id as string | undefined

  if (!companyId) return c.json({ error: 'company_id é obrigatório' }, 400)

  const member = await ensureCompanyMember(db, userId, companyId)
  if (!member) return c.json({ error: 'forbidden' }, 403)

  const { data, error } = await db.from('transactions').insert(body).select().single()
  if (error) return c.json({ error: error.message }, 400)
  return c.json(data, 201)
})

router.patch('/:id', async (c) => {
  const userId = c.get('userId')
  const db = createServiceClient()
  const transactionId = c.req.param('id')
  const payload = await c.req.json<Record<string, unknown>>()

  const row = await db.from('transactions').select('company_id').eq('id', transactionId).single()
  if (!row.data) return c.json({ error: 'not found' }, 404)

  const member = await ensureCompanyMember(db, userId, row.data.company_id)
  if (!member) return c.json({ error: 'forbidden' }, 403)

  const { data, error } = await db.from('transactions').update(payload).eq('id', transactionId).select().single()
  if (error) return c.json({ error: error.message }, 400)
  return c.json(data)
})

router.delete('/:id', async (c) => {
  const userId = c.get('userId')
  const db = createServiceClient()
  const transactionId = c.req.param('id')

  const row = await db.from('transactions').select('company_id').eq('id', transactionId).single()
  if (!row.data) return c.json({ error: 'not found' }, 404)

  const member = await ensureCompanyMember(db, userId, row.data.company_id)
  if (!member) return c.json({ error: 'forbidden' }, 403)

  const { error } = await db.from('transactions').delete().eq('id', transactionId)
  if (error) return c.json({ error: error.message }, 400)
  return c.json({ ok: true })
})

export default router
