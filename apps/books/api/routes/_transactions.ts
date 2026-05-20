import { Hono } from 'hono'
import { createServiceClient, type HonoVariables } from '../_shared'

const router = new Hono<{ Variables: HonoVariables }>()

// ── helpers ───────────────────────────────────────────────────

async function authorizeExt(db: ReturnType<typeof createServiceClient>, userId: string, extCompanyId: string) {
  const { data } = await db.from('external_companies')
    .select('id').eq('id', extCompanyId).eq('accountant_id', userId).maybeSingle()
  return !!data
}

async function authorizeFlow(db: ReturnType<typeof createServiceClient>, userId: string, companyId: string) {
  const { data } = await db.from('accountant_companies')
    .select('id').eq('accountant_id', userId).eq('company_id', companyId).eq('status', 'accepted').maybeSingle()
  return !!data
}

// ── GET /api/transactions ──────────────────────────────────────
router.get('/', async (c) => {
  const userId = c.get('userId')
  const db = createServiceClient()
  const { company_id: companyId, ext_company_id: extCompanyId, type, is_paid, date_from, date_to, search, page = '1', page_size: pageSize = '20' } = c.req.query()

  if (!companyId && !extCompanyId) return c.json({ error: 'company_id_required' }, 400)

  if (companyId) {
    if (!(await authorizeFlow(db, userId, companyId))) return c.json({ error: 'forbidden' }, 403)
  } else {
    if (!(await authorizeExt(db, userId, extCompanyId!))) return c.json({ error: 'forbidden' }, 403)
  }

  const pageNum = Math.max(1, parseInt(page))
  const size    = Math.min(1000, Math.max(1, parseInt(pageSize)))
  const from    = (pageNum - 1) * size
  const to      = from + size - 1

  // Build query — use `as any` to avoid Supabase's strict column inference on dynamic strings
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let q = (db.from('transactions') as any)
    .select('id, company_id, ext_company_id, description, amount, type, date, is_paid, paid_at, nature, notes, category_id, contact_id, is_installment, installment_number, installment_count, payment_method, bank_id, created_by, created_at, updated_at, categories(id, name, color)', { count: 'exact' })
    .order('date', { ascending: false })
    .range(from, to)

  if (companyId)    q = q.eq('company_id', companyId)
  else              q = q.eq('ext_company_id', extCompanyId!)
  if (type)         q = q.eq('type', type)
  if (is_paid)      q = q.eq('is_paid', is_paid === 'true')
  if (date_from)    q = q.gte('date', date_from)
  if (date_to)      q = q.lte('date', date_to)
  if (search)       q = q.ilike('description', `%${search}%`)

  const { data: txs, count, error } = await q
  if (error) return c.json({ error: 'internal_error' }, 500)
  if (!txs?.length) return c.json({ data: [], count: 0 })

  // Fetch classification status
  const txIds = (txs as { id: string }[]).map(t => t.id)
  const entryQ = db.from('journal_entries')
    .select('flow_transaction_id, id')
    .in('flow_transaction_id', txIds)

  const { data: entries } = companyId
    ? await entryQ.eq('company_id', companyId)
    : await entryQ.eq('ext_company_id', extCompanyId!)

  const classifiedMap = new Map((entries ?? []).map(e => [e.flow_transaction_id as string, e.id as string]))

  return c.json({
    data: (txs as { id: string }[]).map(t => ({
      ...t,
      is_classified:    classifiedMap.has(t.id),
      journal_entry_id: classifiedMap.get(t.id) ?? null,
    })),
    count: count ?? 0,
  })
})

// ── GET /api/transactions/:id ─────────────────────────────────
router.get('/:id', async (c) => {
  const userId = c.get('userId')
  const db = createServiceClient()
  const { id } = c.req.param()

  const { data: tx, error } = await db.from('transactions')
    .select(`
      *,
      categories(id, name, color),
      banks(id, name),
      contacts(id, name, cpf, cnpj),
      creator:profiles!transactions_created_by_fkey(full_name),
      registrar:profiles!transactions_payment_registered_by_fkey(full_name)
    `)
    .eq('id', id)
    .single()

  if (error || !tx) return c.json({ error: 'not_found' }, 404)

  if (tx.company_id) {
    if (!(await authorizeFlow(db, userId, tx.company_id))) return c.json({ error: 'not_found' }, 404)
  } else if (tx.ext_company_id) {
    if (!(await authorizeExt(db, userId, tx.ext_company_id))) return c.json({ error: 'not_found' }, 404)
  } else {
    return c.json({ error: 'not_found' }, 404)
  }

  return c.json({
    ...tx,
    creator_name:           (tx.creator as { full_name: string } | null)?.full_name ?? null,
    payment_registrar_name: (tx.registrar as { full_name: string } | null)?.full_name ?? null,
  })
})

// GET /api/transactions/counterparts — distinct counterpart values for an ext company
router.get('/counterparts', async (c) => {
  const userId = c.get('userId')
  const db = createServiceClient()
  const { ext_company_id: extCompanyId } = c.req.query()

  if (!extCompanyId) return c.json({ error: 'company_id_required' }, 400)
  if (!(await authorizeExt(db, userId, extCompanyId))) return c.json({ error: 'forbidden' }, 403)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (db.from('transactions') as any)
    .select('counterpart')
    .eq('ext_company_id', extCompanyId)
    .not('counterpart', 'is', null)

  if (error) return c.json({ error: 'internal_error' }, 500)
  const unique = [...new Set((data ?? []).map((r: { counterpart: string }) => r.counterpart).filter(Boolean))] as string[]
  return c.json(unique.sort())
})

// ── POST /api/transactions ────────────────────────────────────
// Creates a transaction for an external (non-Flow) company.
router.post('/', async (c) => {
  const userId = c.get('userId')
  const db = createServiceClient()
  const body = await c.req.json<{
    ext_company_id: string
    description: string
    amount: number
    type: 'income' | 'expense'
    date: string
    is_paid: boolean
    paid_at?: string | null
    nature: string
    counterpart?: string | null
    notes?: string | null
  }>()

  if (!body.ext_company_id) return c.json({ error: 'ext_company_id required' }, 400)
  if (!body.description?.trim()) return c.json({ error: 'description required' }, 400)
  if (!body.amount || body.amount <= 0) return c.json({ error: 'amount must be positive' }, 400)
  if (!body.date) return c.json({ error: 'date required' }, 400)
  if (!body.counterpart?.trim()) return c.json({ error: 'counterpart required' }, 400)
  if (!body.nature?.trim()) return c.json({ error: 'nature required' }, 400)
  if (!body.type) return c.json({ error: 'type required' }, 400)
  if (body.is_paid && !body.paid_at) return c.json({ error: 'paid_at required when is_paid is true' }, 400)

  if (!(await authorizeExt(db, userId, body.ext_company_id))) return c.json({ error: 'forbidden' }, 403)

  const { data, error } = await db.from('transactions').insert({
    ext_company_id: body.ext_company_id,
    created_by:     userId,
    description:    body.description.trim(),
    amount:         body.amount,
    type:           body.type,
    date:           body.date,
    is_paid:        body.is_paid ?? false,
    paid_at:        body.is_paid ? (body.paid_at || null) : null,
    nature:         body.nature || null,
    counterpart:    body.counterpart || null,
    notes:          body.notes || null,
  }).select('*').single()

  if (error) return c.json({ error: 'internal_error' }, 500)
  return c.json(data, 201)
})

// ── PATCH /api/transactions/:id ───────────────────────────────
router.patch('/:id', async (c) => {
  const userId = c.get('userId')
  const db = createServiceClient()
  const { id } = c.req.param()

  const { data: existing } = await db.from('transactions')
    .select('ext_company_id').eq('id', id).maybeSingle()

  if (!existing?.ext_company_id) return c.json({ error: 'not_found' }, 404)
  if (!(await authorizeExt(db, userId, existing.ext_company_id))) return c.json({ error: 'forbidden' }, 403)

  const body = await c.req.json<{
    description?: string
    amount?: number
    type?: 'income' | 'expense'
    date?: string
    is_paid?: boolean
    paid_at?: string | null
    nature?: string | null
    counterpart?: string | null
    notes?: string | null
  }>()

  // Whitelist — nunca permite sobrescrever ext_company_id, company_id, created_by, etc.
  const patch: Record<string, unknown> = {}
  if (body.description !== undefined) patch.description = body.description
  if (body.amount      !== undefined) patch.amount      = body.amount
  if (body.type        !== undefined) patch.type        = body.type
  if (body.date        !== undefined) patch.date        = body.date
  if (body.nature      !== undefined) patch.nature      = body.nature
  if (body.counterpart !== undefined) patch.counterpart = body.counterpart
  if (body.notes       !== undefined) patch.notes       = body.notes
  if (body.is_paid     !== undefined) patch.is_paid     = body.is_paid
  if (body.is_paid === false) patch.paid_at = null
  else if (body.paid_at !== undefined) patch.paid_at = body.paid_at

  if (Object.keys(patch).length === 0) return c.json({ error: 'no_changes' }, 400)
  if ('counterpart' in patch && !patch.counterpart?.toString().trim()) {
    return c.json({ error: 'counterpart required' }, 400)
  }
  if ('nature' in patch && !patch.nature?.toString().trim()) {
    return c.json({ error: 'nature required' }, 400)
  }
  if (patch.is_paid === true && !patch.paid_at) {
    return c.json({ error: 'paid_at required when is_paid is true' }, 400)
  }

  const { data, error } = await db.from('transactions')
    .update(patch).eq('id', id).select('*').single()

  if (error) return c.json({ error: 'internal_error' }, 500)
  return c.json(data)
})

// ── DELETE /api/transactions/:id ──────────────────────────────
router.delete('/:id', async (c) => {
  const userId = c.get('userId')
  const db = createServiceClient()
  const { id } = c.req.param()

  const { data: existing } = await db.from('transactions')
    .select('ext_company_id').eq('id', id).maybeSingle()

  if (!existing?.ext_company_id) return c.json({ error: 'not_found' }, 404)
  if (!(await authorizeExt(db, userId, existing.ext_company_id))) return c.json({ error: 'forbidden' }, 403)

  const { error } = await db.from('transactions').delete().eq('id', id)
  if (error) return c.json({ error: 'internal_error' }, 500)
  return c.json({ ok: true })
})

export default router
