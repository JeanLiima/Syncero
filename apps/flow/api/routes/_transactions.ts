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

router.get('/:id', async (c) => {
  const userId = c.get('userId')
  const db = createServiceClient()
  const transactionId = c.req.param('id')

  const { data: tx, error } = await db.from('transactions')
    .select('*, categories(id, name, color), contacts(id, name, cpf, cnpj), banks(id, name)')
    .eq('id', transactionId)
    .single()

  if (error || !tx) return c.json({ error: 'not found' }, 404)

  const member = await ensureCompanyMember(db, userId, tx.company_id)
  if (!member) return c.json({ error: 'forbidden' }, 403)

  const profileIds = [...new Set([tx.created_by, tx.payment_registered_by].filter(Boolean))]
  const profileMap: Record<string, string> = {}
  if (profileIds.length > 0) {
    const { data: rows } = await db.from('profiles').select('id, full_name').in('id', profileIds)
    for (const p of rows ?? []) profileMap[p.id] = p.full_name
  }

  return c.json({
    ...tx,
    creator_name: profileMap[tx.created_by] ?? null,
    payment_registrar_name: tx.payment_registered_by ? (profileMap[tx.payment_registered_by] ?? null) : null,
  })
})

router.get('/', async (c) => {
  const userId = c.get('userId')
  const db = createServiceClient()
  const companyId = c.req.query('companyId')
  if (!companyId) return c.json({ error: 'companyId é obrigatório' }, 400)

  const member = await ensureCompanyMember(db, userId, companyId)
  if (!member) return c.json({ error: 'forbidden' }, 403)

  let query = db.from('transactions')
    .select('*, categories(id, name, color), contacts(id, name, cpf, cnpj)', { count: 'exact' })
    .eq('company_id', companyId)
    .order('date', { ascending: false })

  const type = c.req.query('type')
  const categoryId = c.req.query('category_id')
  const isPaid = c.req.query('is_paid')
  const dateFrom = c.req.query('date_from')
  const dateTo = c.req.query('date_to')
  const search = c.req.query('search')
  const page = Number(c.req.query('page') ?? '1')
  const pageSize = Math.min(Number(c.req.query('pageSize') ?? '20'), 1000)

  const installmentGroupId = c.req.query('installment_group_id')

  if (type) query = query.eq('type', type)
  if (categoryId === 'none') query = query.is('category_id', null)
  else if (categoryId) query = query.eq('category_id', categoryId)
  if (installmentGroupId) query = query.eq('installment_group_id', installmentGroupId)
  if (isPaid === 'true') query = query.eq('is_paid', true)
  if (isPaid === 'false') query = query.eq('is_paid', false)
  if (dateFrom) query = query.gte('date', dateFrom)
  if (dateTo) query = query.lte('date', dateTo)
  if (search) query = query.ilike('description', `%${search}%`)

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

  const b = body as Record<string, unknown>
  const { data, error } = await db.from('transactions').insert({
    company_id:           companyId,
    created_by:           userId,
    description:          b.description as string,
    amount:               b.amount as number,
    type:                 b.type as string,
    date:                 b.date as string,
    is_paid:              (b.is_paid as boolean) ?? false,
    paid_at:              (b.paid_at as string | null) ?? null,
    nature:               (b.nature as string | null) ?? null,
    notes:                (b.notes as string | null) ?? null,
    category_id:          (b.category_id as string | null) ?? null,
    contact_id:           (b.contact_id as string | null) ?? null,
    bank_id:              (b.bank_id as string | null) ?? null,
    payment_method:       (b.payment_method as string | null) ?? null,
    is_installment:       (b.is_installment as boolean) ?? false,
    installment_count:    (b.installment_count as number | null) ?? null,
    installment_number:   (b.installment_number as number | null) ?? null,
    installment_group_id: (b.installment_group_id as string | null) ?? null,
  }).select().single()
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

  const p = payload as Record<string, unknown>
  const allowed: Record<string, unknown> = {}
  const editableFields = ['description','amount','type','date','is_paid','paid_at','nature','notes',
    'category_id','contact_id','bank_id','payment_method','is_installment','installment_count',
    'installment_number','payment_registered_at','payment_registered_by']
  for (const f of editableFields) if (f in p) allowed[f] = p[f]
  if (Object.keys(allowed).length === 0) return c.json({ error: 'No valid fields to update' }, 400)

  const { data, error } = await db.from('transactions').update(allowed).eq('id', transactionId).select().single()
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
