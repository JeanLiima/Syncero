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
  const companyId = c.req.query('company_id')
  const type = c.req.query('type')

  if (!companyId) return c.json({ error: 'company_id é obrigatório' }, 400)

  const member = await ensureCompanyMember(db, userId, companyId)
  if (!member) return c.json({ error: 'forbidden' }, 403)

  let query = db.from('payables_receivables').select('*').eq('company_id', companyId).order('due_date')
  if (type) query = query.eq('type', type)

  const { data, error } = await query
  if (error) return c.json({ error: error.message }, 400)
  return c.json(data)
})

router.post('/', async (c) => {
  const userId = c.get('userId')
  const db = createServiceClient()
  const body = await c.req.json<Record<string, unknown>>()
  const companyId = body.company_id as string | undefined
  if (!companyId) return c.json({ error: 'company_id é obrigatório' }, 400)

  const member = await ensureCompanyMember(db, userId, companyId)
  if (!member) return c.json({ error: 'forbidden' }, 403)

  const b = body as Record<string, unknown>
  const { data, error } = await db.from('payables_receivables').insert({
    company_id:   companyId,
    type:         b.type as string,
    description:  b.description as string,
    amount:       b.amount as number,
    due_date:     b.due_date as string,
    is_paid:      (b.is_paid as boolean) ?? false,
    paid_at:      (b.paid_at as string | null) ?? null,
    notes:        (b.notes as string | null) ?? null,
    contact_id:   (b.contact_id as string | null) ?? null,
    contact_name: (b.contact_name as string | null) ?? null,
  }).select().single()
  if (error) return c.json({ error: error.message }, 400)
  return c.json(data, 201)
})

router.patch('/:id', async (c) => {
  const userId = c.get('userId')
  const db = createServiceClient()
  const payableId = c.req.param('id')
  const payload = await c.req.json<Record<string, unknown>>()

  const row = await db.from('payables_receivables').select('company_id').eq('id', payableId).single()
  if (!row.data) return c.json({ error: 'not found' }, 404)

  const member = await ensureCompanyMember(db, userId, row.data.company_id)
  if (!member) return c.json({ error: 'forbidden' }, 403)

  const p = payload as Record<string, unknown>
  const allowed: Record<string, unknown> = {}
  const editableFields = ['type','description','amount','due_date','is_paid','paid_at','notes','contact_id','contact_name','status']
  for (const f of editableFields) if (f in p) allowed[f] = p[f]
  if (Object.keys(allowed).length === 0) return c.json({ error: 'No valid fields to update' }, 400)

  const { data, error } = await db.from('payables_receivables').update(allowed).eq('id', payableId).select().single()
  if (error) return c.json({ error: error.message }, 400)
  return c.json(data)
})

router.delete('/:id', async (c) => {
  const userId = c.get('userId')
  const db = createServiceClient()
  const payableId = c.req.param('id')

  const row = await db.from('payables_receivables').select('company_id').eq('id', payableId).single()
  if (!row.data) return c.json({ error: 'not found' }, 404)

  const member = await ensureCompanyMember(db, userId, row.data.company_id)
  if (!member) return c.json({ error: 'forbidden' }, 403)

  const { error } = await db.from('payables_receivables').delete().eq('id', payableId)
  if (error) return c.json({ error: error.message }, 400)
  return c.json({ ok: true })
})

export default router
