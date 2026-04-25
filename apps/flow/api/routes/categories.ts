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

// ── GET /api/categories ───────────────────────────────────────
router.get('/', async (c) => {
  const userId = c.get('userId')
  const db = createServiceClient()
  const companyId = c.req.query('companyId')
  if (!companyId) return c.json({ error: 'companyId é obrigatório' }, 400)

  const member = await ensureCompanyMember(db, userId, companyId)
  if (!member) return c.json({ error: 'forbidden' }, 403)

  const { data, error } = await db.from('categories')
    .select('*')
    .eq('company_id', companyId)
    .order('type')
    .order('name')
  if (error) return c.json({ error: error.message }, 400)

  return c.json(data)
})

// ── GET /api/categories/:id/usage ─────────────────────────────
router.get('/:id/usage', async (c) => {
  const userId = c.get('userId')
  const db = createServiceClient()
  const categoryId = c.req.param('id')

  const row = await db.from('categories').select('company_id').eq('id', categoryId).single()
  if (!row.data) return c.json({ error: 'not found' }, 404)

  const member = await ensureCompanyMember(db, userId, row.data.company_id)
  if (!member) return c.json({ error: 'forbidden' }, 403)

  const { count } = await db.from('transactions')
    .select('*', { count: 'exact', head: true })
    .eq('category_id', categoryId)

  return c.json({ count: count ?? 0 })
})

// ── POST /api/categories ──────────────────────────────────────
router.post('/', async (c) => {
  const userId = c.get('userId')
  const db = createServiceClient()
  const body = await c.req.json<Record<string, unknown>>()
  const companyId = body.company_id as string | undefined
  if (!companyId) return c.json({ error: 'company_id é obrigatório' }, 400)

  const member = await ensureCompanyMember(db, userId, companyId)
  if (!member) return c.json({ error: 'forbidden' }, 403)

  const { data, error } = await db.from('categories').insert(body).select().single()
  if (error) return c.json({ error: error.message }, 400)
  return c.json(data, 201)
})

// ── PATCH /api/categories/:id ─────────────────────────────────
router.patch('/:id', async (c) => {
  const userId = c.get('userId')
  const db = createServiceClient()
  const categoryId = c.req.param('id')
  const payload = await c.req.json<Record<string, unknown>>()

  const row = await db.from('categories').select('company_id').eq('id', categoryId).single()
  if (!row.data) return c.json({ error: 'not found' }, 404)

  const member = await ensureCompanyMember(db, userId, row.data.company_id)
  if (!member) return c.json({ error: 'forbidden' }, 403)

  const { data, error } = await db.from('categories').update(payload).eq('id', categoryId).select().single()
  if (error) return c.json({ error: error.message }, 400)
  return c.json(data)
})

// ── DELETE /api/categories/:id ────────────────────────────────
// Body: { transferTo?: string | null }
//   transferTo = uuid  → reassign transactions to that category then delete
//   transferTo = null  → set transactions category_id to null then delete
//   transferTo absent + transactions exist → 409 with { count }
router.delete('/:id', async (c) => {
  const userId = c.get('userId')
  const db = createServiceClient()
  const categoryId = c.req.param('id')
  const body = await c.req.json<{ transferTo?: string | null }>().catch(() => ({}))
  const transferTo = (body as { transferTo?: string | null }).transferTo

  const row = await db.from('categories').select('company_id').eq('id', categoryId).single()
  if (!row.data) return c.json({ error: 'not found' }, 404)

  const member = await ensureCompanyMember(db, userId, row.data.company_id)
  if (!member) return c.json({ error: 'forbidden' }, 403)

  const { count } = await db.from('transactions')
    .select('*', { count: 'exact', head: true })
    .eq('category_id', categoryId)

  const txCount = count ?? 0

  if (txCount > 0 && transferTo === undefined) {
    return c.json({ error: 'Category in use', count: txCount }, 409)
  }

  if (txCount > 0) {
    if (transferTo) {
      const { data: target } = await db.from('categories')
        .select('company_id').eq('id', transferTo).single()
      if (!target || target.company_id !== row.data.company_id) {
        return c.json({ error: 'Invalid transfer target' }, 400)
      }
      await db.from('transactions').update({ category_id: transferTo }).eq('category_id', categoryId)
    } else {
      await db.from('transactions').update({ category_id: null }).eq('category_id', categoryId)
    }
  }

  const { error } = await db.from('categories').delete().eq('id', categoryId)
  if (error) return c.json({ error: error.message }, 400)
  return c.json({ ok: true })
})

export default router
