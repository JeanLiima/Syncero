import { Hono } from 'hono'
import { createServiceClient, type HonoVariables } from '../_shared'

const router = new Hono<{ Variables: HonoVariables }>()

// ── Authorization helpers ─────────────────────────────────────

async function canAccessCompany(
  db: ReturnType<typeof createServiceClient>,
  userId: string,
  companyId: string,
): Promise<boolean> {
  const [member, accountant] = await Promise.all([
    db.from('company_members').select('id').eq('user_id', userId).eq('company_id', companyId).eq('status', 'accepted').maybeSingle(),
    db.from('accountant_companies').select('id').eq('accountant_id', userId).eq('company_id', companyId).eq('status', 'accepted').maybeSingle(),
  ])
  return Boolean(member.data || accountant.data)
}

async function canAccessExtCompany(
  db: ReturnType<typeof createServiceClient>,
  userId: string,
  extCompanyId: string,
): Promise<boolean> {
  const { data } = await db.from('external_companies')
    .select('id').eq('id', extCompanyId).eq('accountant_id', userId).maybeSingle()
  return Boolean(data)
}

async function getBookOwner(
  db: ReturnType<typeof createServiceClient>,
  userId: string,
  bookId: string,
): Promise<boolean> {
  const { data } = await db.from('fiscal_books').select('company_id, ext_company_id').eq('id', bookId).maybeSingle()
  if (!data) return false
  if (data.company_id) return canAccessCompany(db, userId, data.company_id)
  if (data.ext_company_id) return canAccessExtCompany(db, userId, data.ext_company_id)
  return false
}

// ── GET /api/fiscal-books ─────────────────────────────────────

router.get('/', async (c) => {
  const userId = c.get('userId')
  const db = createServiceClient()
  const { company_id, ext_company_id } = c.req.query()

  if (!company_id && !ext_company_id) return c.json({ error: 'company_id or ext_company_id required' }, 400)

  if (company_id) {
    const ok = await canAccessCompany(db, userId, company_id)
    if (!ok) return c.json({ error: 'forbidden' }, 403)
  } else {
    const ok = await canAccessExtCompany(db, userId, ext_company_id!)
    if (!ok) return c.json({ error: 'forbidden' }, 403)
  }

  const q = db.from('fiscal_books').select('*').order('created_at', { ascending: false })
  const { data, error } = company_id
    ? await q.eq('company_id', company_id)
    : await q.eq('ext_company_id', ext_company_id!)

  if (error) return c.json({ error: error.message }, 400)
  return c.json(data)
})

// ── POST /api/fiscal-books ────────────────────────────────────

router.post('/', async (c) => {
  const userId = c.get('userId')
  const db = createServiceClient()
  const body = await c.req.json<{
    company_id?: string
    ext_company_id?: string
    book_type: string
    reference_period: string
    status?: string
  }>()

  if (!body.company_id && !body.ext_company_id) return c.json({ error: 'company_id or ext_company_id required' }, 400)
  if (!body.book_type) return c.json({ error: 'book_type required' }, 400)
  if (!body.reference_period) return c.json({ error: 'reference_period required' }, 400)

  if (body.company_id) {
    const ok = await canAccessCompany(db, userId, body.company_id)
    if (!ok) return c.json({ error: 'forbidden' }, 403)
  } else {
    const ok = await canAccessExtCompany(db, userId, body.ext_company_id!)
    if (!ok) return c.json({ error: 'forbidden' }, 403)
  }

  const { data, error } = await db.from('fiscal_books').insert({
    ...(body.company_id ? { company_id: body.company_id } : { ext_company_id: body.ext_company_id }),
    book_type: body.book_type,
    reference_period: body.reference_period,
    status: body.status ?? 'draft',
  }).select('*').single()

  if (error) return c.json({ error: error.message }, 400)
  return c.json(data, 201)
})

// ── PATCH /api/fiscal-books/:id ───────────────────────────────

router.patch('/:id', async (c) => {
  const userId = c.get('userId')
  const db = createServiceClient()
  const { id } = c.req.param()
  const body = await c.req.json<{ status: string }>()

  const ok = await getBookOwner(db, userId, id)
  if (!ok) return c.json({ error: 'forbidden' }, 403)

  const { data, error } = await db.from('fiscal_books')
    .update({ status: body.status, ...(body.status === 'transmitted' ? { transmitted_at: new Date().toISOString() } : {}) })
    .eq('id', id)
    .select('*')
    .single()

  if (error) return c.json({ error: error.message }, 400)
  return c.json(data)
})

// ── DELETE /api/fiscal-books/:id ──────────────────────────────

router.delete('/:id', async (c) => {
  const userId = c.get('userId')
  const db = createServiceClient()
  const { id } = c.req.param()

  const ok = await getBookOwner(db, userId, id)
  if (!ok) return c.json({ error: 'forbidden' }, 403)

  const { error } = await db.from('fiscal_books').delete().eq('id', id)
  if (error) return c.json({ error: error.message }, 400)
  return c.json({ ok: true })
})

export default router
