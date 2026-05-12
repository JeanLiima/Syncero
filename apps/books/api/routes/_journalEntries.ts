import { Hono } from 'hono'
import { createServiceClient, type HonoVariables } from '../_shared'

const router = new Hono<{ Variables: HonoVariables }>()

// ── GET /api/journal-entries ──────────────────────────────────
router.get('/', async (c) => {
  const userId = c.get('userId')
  const db = createServiceClient()
  const { company_id: companyId, ext_company_id: extCompanyId, period } = c.req.query()

  if (!companyId && !extCompanyId) return c.json({ error: 'company_id or ext_company_id required' }, 400)

  if (companyId) {
    const { data: acct } = await db.from('accountant_companies')
      .select('id').eq('accountant_id', userId).eq('company_id', companyId).eq('status', 'accepted').maybeSingle()
    if (!acct) return c.json({ error: 'Forbidden: not authorized for this company' }, 403)
  } else {
    const { data: ec } = await db.from('external_companies')
      .select('id').eq('id', extCompanyId!).eq('accountant_id', userId).maybeSingle()
    if (!ec) return c.json({ error: 'Forbidden: not authorized for this external company' }, 403)
  }

  let dateFrom: string | undefined
  let dateTo: string | undefined
  if (period) {
    const [y, m] = period.split('-').map(Number)
    const lastDay = new Date(y, m, 0).getDate()
    dateFrom = `${period}-01`
    dateTo   = `${period}-${String(lastDay).padStart(2, '0')}`
  }

  let q = db.from('journal_entries')
    .select('id, entry_date, description, external_ref, source, journal_entry_lines(side, amount, memo, account_plans(code, name))')
    .order('entry_date', { ascending: false })
  if (companyId) q = q.eq('company_id', companyId)
  else q = q.eq('ext_company_id', extCompanyId!)
  if (dateFrom) q = q.gte('entry_date', dateFrom).lte('entry_date', dateTo!)

  const { data, error } = await q
  if (error) return c.json({ error: 'Failed to fetch journal entries' }, 500)
  return c.json(data ?? [])
})

// ── POST /api/journal-entries ─────────────────────────────────
router.post('/', async (c) => {
  const userId = c.get('userId')
  const db = createServiceClient()
  const body = await c.req.json<{
    entry_date: string; description: string; external_ref?: string
    flow_transaction_id?: string
    lines: Array<{ account_plan_id: string; side: 'debit' | 'credit'; amount: number; memo?: string }>
    company_id?: string; ext_company_id?: string
  }>()

  if (!body.company_id && !body.ext_company_id) return c.json({ error: 'company_id or ext_company_id required' }, 400)

  // Verify authorization
  if (body.company_id) {
    const { data: acct } = await db.from('accountant_companies')
      .select('id').eq('accountant_id', userId).eq('company_id', body.company_id).eq('status', 'accepted').maybeSingle()
    if (!acct) return c.json({ error: 'Forbidden: not authorized for this company' }, 403)
  } else {
    const { data: ec } = await db.from('external_companies')
      .select('id').eq('id', body.ext_company_id!).eq('accountant_id', userId).maybeSingle()
    if (!ec) return c.json({ error: 'Forbidden: not authorized for this external company' }, 403)
  }

  // Validar que flow_transaction_id pertence à empresa autorizada
  if (body.flow_transaction_id) {
    const { data: tx } = await db.from('transactions')
      .select('company_id, ext_company_id').eq('id', body.flow_transaction_id).maybeSingle()
    if (!tx) return c.json({ error: 'flow_transaction_id not found' }, 404)
    const expectedId = body.company_id ?? body.ext_company_id
    const txCompany  = body.company_id ? tx.company_id : tx.ext_company_id
    if (txCompany !== expectedId) return c.json({ error: 'flow_transaction_id does not belong to the authorized company' }, 403)
  }

  const { data: entry, error } = await db.from('journal_entries').insert({
    ...(body.ext_company_id ? { ext_company_id: body.ext_company_id } : { company_id: body.company_id }),
    accountant_id: userId,
    entry_date: body.entry_date,
    description: body.description,
    external_ref: body.external_ref || null,
    flow_transaction_id: body.flow_transaction_id || null,
    source: body.flow_transaction_id ? 'syncero_import' : 'manual',
  }).select('id').single()
  if (error) return c.json({ error: 'Failed to create journal entry' }, 500)

  const { error: linesErr } = await db.from('journal_entry_lines').insert(
    body.lines.map(l => ({
      entry_id: entry.id,
      account_plan_id: l.account_plan_id,
      side: l.side,
      amount: l.amount,
      memo: l.memo || null,
    }))
  )
  if (linesErr) return c.json({ error: 'Failed to create journal entry lines' }, 500)
  return c.json({ id: entry.id }, 201)
})


export default router
