import { Hono } from 'hono'
import { createServiceClient, ensureCompanyMember, type HonoVariables } from '../_shared'

const router = new Hono<{ Variables: HonoVariables }>()

type TransactionBody = {
  company_id?: string
  description?: string
  amount?: number
  type?: string
  date?: string
  is_paid?: boolean
  paid_at?: string | null
  nature?: string | null
  counterpart?: string | null
  notes?: string | null
  category_id?: string | null
  contact_id?: string | null
  bank_id?: string | null
  payment_method?: string | null
  is_installment?: boolean
  installment_count?: number | null
  installment_number?: number | null
  installment_group_id?: string | null
}

router.get('/:id', async (c) => {
  const userId = c.get('userId')
  const db = createServiceClient()
  const transactionId = c.req.param('id')

  const { data: tx, error } = await db.from('transactions')
    .select('*, categories(id, name, color), contacts(id, name, cpf, cnpj), banks(id, name)')
    .eq('id', transactionId)
    .single()

  if (error || !tx) return c.json({ error: 'not_found' }, 404)

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
  const companyId = c.req.query('company_id')
  if (!companyId) return c.json({ error: 'company_id_required' }, 400)

  const member = await ensureCompanyMember(db, userId, companyId)
  if (!member) return c.json({ error: 'forbidden' }, 403)

  let query = db.from('transactions')
    .select('*, categories(id, name, color), contacts(id, name, cpf, cnpj)', { count: 'exact' })
    .eq('company_id', companyId)
    .order('date', { ascending: false })

  const type              = c.req.query('type')
  const categoryId        = c.req.query('category_id')
  const isPaid            = c.req.query('is_paid')
  const dateFrom          = c.req.query('date_from')
  const dateTo            = c.req.query('date_to')
  const search            = c.req.query('search')
  const page              = Number(c.req.query('page') ?? '1')
  const pageSize          = Math.min(Number(c.req.query('page_size') ?? '20'), 1000)
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
  if (error) return c.json({ error: 'internal_error' }, 500)

  return c.json({ data, count })
})

router.post('/', async (c) => {
  const userId = c.get('userId')
  const db = createServiceClient()
  const body = await c.req.json<TransactionBody>()
  const { company_id: companyId, ...txData } = body

  if (!companyId) return c.json({ error: 'company_id_required' }, 400)

  const member = await ensureCompanyMember(db, userId, companyId)
  if (!member) return c.json({ error: 'forbidden' }, 403)

  if (!txData.counterpart?.trim()) return c.json({ error: 'counterpart_required' }, 400)
  if (!txData.nature?.trim()) return c.json({ error: 'nature_required' }, 400)
  if (txData.is_paid && !txData.paid_at) return c.json({ error: 'paid_at_required' }, 400)

  const { data, error } = await db.from('transactions').insert({
    company_id:           companyId,
    created_by:           userId,
    description:          txData.description ?? '',
    amount:               txData.amount ?? 0,
    type:                 txData.type ?? '',
    date:                 txData.date ?? '',
    is_paid:              txData.is_paid ?? false,
    paid_at:              txData.paid_at ?? null,
    nature:               txData.nature ?? null,
    counterpart:          txData.counterpart ?? null,
    notes:                txData.notes ?? null,
    category_id:          txData.category_id ?? null,
    contact_id:           txData.contact_id ?? null,
    bank_id:              txData.bank_id ?? null,
    payment_method:       txData.payment_method ?? null,
    is_installment:       txData.is_installment ?? false,
    installment_count:    txData.installment_count ?? null,
    installment_number:   txData.installment_number ?? null,
    installment_group_id: txData.installment_group_id ?? null,
  }).select().single()
  if (error) return c.json({ error: 'internal_error' }, 500)
  return c.json(data, 201)
})

router.patch('/group/:groupId', async (c) => {
  const userId = c.get('userId')
  const db = createServiceClient()
  const { groupId } = c.req.param()

  const { data: sample } = await db.from('transactions')
    .select('company_id')
    .eq('installment_group_id', groupId)
    .limit(1)
    .maybeSingle()

  if (!sample?.company_id) return c.json({ error: 'not_found' }, 404)

  const member = await ensureCompanyMember(db, userId, sample.company_id)
  if (!member) return c.json({ error: 'forbidden' }, 403)

  const body = await c.req.json<{ nature?: string | null }>()
  const patch: Record<string, unknown> = {}
  if ('nature' in body) patch.nature = body.nature

  if (Object.keys(patch).length === 0) return c.json({ error: 'no_changes' }, 400)

  const { error } = await db.from('transactions')
    .update(patch)
    .eq('installment_group_id', groupId)

  if (error) return c.json({ error: 'internal_error' }, 500)
  return c.json({ ok: true })
})

router.patch('/:id', async (c) => {
  const userId = c.get('userId')
  const db = createServiceClient()
  const transactionId = c.req.param('id')
  const payload = await c.req.json<Record<string, unknown>>()

  const row = await db.from('transactions').select('company_id').eq('id', transactionId).single()
  if (!row.data) return c.json({ error: 'not_found' }, 404)

  const member = await ensureCompanyMember(db, userId, row.data.company_id)
  if (!member) return c.json({ error: 'forbidden' }, 403)

  const allowed: Record<string, unknown> = {}
  const editableFields = ['description','amount','type','date','is_paid','paid_at','nature','counterpart','notes',
    'category_id','contact_id','bank_id','payment_method','is_installment','installment_count',
    'installment_number','payment_registered_at','payment_registered_by']
  for (const f of editableFields) if (f in payload) allowed[f] = payload[f]
  if (Object.keys(allowed).length === 0) return c.json({ error: 'no_changes' }, 400)
  if ('counterpart' in allowed && !allowed.counterpart?.toString().trim()) {
    return c.json({ error: 'counterpart_required' }, 400)
  }
  if ('nature' in allowed && !allowed.nature?.toString().trim()) {
    return c.json({ error: 'nature_required' }, 400)
  }
  if (allowed.is_paid === true && !allowed.paid_at) {
    return c.json({ error: 'paid_at_required' }, 400)
  }

  const { data, error } = await db.from('transactions').update(allowed).eq('id', transactionId).select().single()
  if (error) return c.json({ error: 'internal_error' }, 500)
  return c.json(data)
})

router.delete('/:id', async (c) => {
  const userId = c.get('userId')
  const db = createServiceClient()
  const transactionId = c.req.param('id')

  const row = await db.from('transactions').select('company_id').eq('id', transactionId).single()
  if (!row.data) return c.json({ error: 'not_found' }, 404)

  const member = await ensureCompanyMember(db, userId, row.data.company_id)
  if (!member) return c.json({ error: 'forbidden' }, 403)

  const { error } = await db.from('transactions').delete().eq('id', transactionId)
  if (error) return c.json({ error: 'internal_error' }, 500)
  return c.json({ ok: true })
})

export default router
