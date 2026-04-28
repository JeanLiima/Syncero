import { Hono } from 'hono'
import { createServiceClient, type HonoVariables } from '../_shared'

const router = new Hono<{ Variables: HonoVariables }>()

// ── GET /api/journal-entries ──────────────────────────────────
router.get('/', async (c) => {
  const userId = c.get('userId')
  const db = createServiceClient()
  const { companyId, extCompanyId, period } = c.req.query()

  if (!companyId && !extCompanyId) return c.json({ error: 'companyId or extCompanyId required' }, 400)

  if (companyId) {
    const { data: acct } = await db.from('accountant_companies')
      .select('id').eq('accountant_id', userId).eq('company_id', companyId).eq('status', 'accepted').maybeSingle()
    if (!acct) return c.json({ error: 'Forbidden: not authorized for this company' }, 403)
  } else {
    const { data: ec } = await db.from('external_companies')
      .select('id').eq('id', extCompanyId!).eq('accountant_id', userId).maybeSingle()
    if (!ec) return c.json({ error: 'Forbidden: not authorized for this external company' }, 403)
  }

  const dateFrom = period ? `${period}-01` : undefined
  const dateTo   = period ? `${period}-31` : undefined

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
    companyId?: string; extCompanyId?: string
  }>()

  if (!body.companyId && !body.extCompanyId) return c.json({ error: 'companyId or extCompanyId required' }, 400)

  // Verify authorization
  if (body.companyId) {
    const { data: acct } = await db.from('accountant_companies')
      .select('id').eq('accountant_id', userId).eq('company_id', body.companyId).eq('status', 'accepted').maybeSingle()
    if (!acct) return c.json({ error: 'Forbidden: not authorized for this company' }, 403)
  } else {
    const { data: ec } = await db.from('external_companies')
      .select('id').eq('id', body.extCompanyId!).eq('accountant_id', userId).maybeSingle()
    if (!ec) return c.json({ error: 'Forbidden: not authorized for this external company' }, 403)
  }

  const { data: entry, error } = await db.from('journal_entries').insert({
    ...(body.extCompanyId ? { ext_company_id: body.extCompanyId } : { company_id: body.companyId }),
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

// ── POST /api/journal-entries/import ─────────────────────────
router.post('/import', async (c) => {
  const userId = c.get('userId')
  const db = createServiceClient()
  const body = await c.req.json<{
    entries: Array<{
      entry_date: string; description: string; external_ref?: string
      lines: Array<{ account_code: string; side: 'debit' | 'credit'; amount: number; memo?: string }>
    }>
    companyId?: string; extCompanyId?: string
  }>()

  if (!body.companyId && !body.extCompanyId) return c.json({ error: 'companyId or extCompanyId required' }, 400)

  // Verify authorization
  if (body.companyId) {
    const { data: acct } = await db.from('accountant_companies')
      .select('id').eq('accountant_id', userId).eq('company_id', body.companyId).eq('status', 'accepted').maybeSingle()
    if (!acct) return c.json({ error: 'Forbidden: not authorized for this company' }, 403)
  } else {
    const { data: ec } = await db.from('external_companies')
      .select('id').eq('id', body.extCompanyId!).eq('accountant_id', userId).maybeSingle()
    if (!ec) return c.json({ error: 'Forbidden: not authorized for this external company' }, 403)
  }

  const accountsQ = db.from('account_plans').select('id, code').eq('is_active', true)
  const { data: accountsData } = body.extCompanyId
    ? await accountsQ.eq('ext_company_id', body.extCompanyId)
    : await accountsQ.eq('company_id', body.companyId!)
  const codeToId = new Map((accountsData ?? []).map(a => [a.code, a.id]))

  const inserted: string[] = []
  for (const pe of body.entries) {
    const { data: entry, error } = await db.from('journal_entries').insert({
      ...(body.extCompanyId ? { ext_company_id: body.extCompanyId } : { company_id: body.companyId }),
      accountant_id: userId,
      entry_date: pe.entry_date,
      description: pe.description,
      external_ref: pe.external_ref || null,
      source: 'dominio_import',
    }).select('id').single()
    if (error) return c.json({ error: 'Failed to create journal entry' }, 500)

    const lines = pe.lines
      .filter(l => codeToId.has(l.account_code))
      .map(l => ({
        entry_id: entry.id,
        account_plan_id: codeToId.get(l.account_code)!,
        side: l.side,
        amount: l.amount,
        memo: l.memo || null,
      }))
    if (lines.length) {
      const { error: linesErr } = await db.from('journal_entry_lines').insert(lines)
      if (linesErr) return c.json({ error: 'Failed to create journal entry lines' }, 500)
    }
    inserted.push(entry.id)
  }

  return c.json({ inserted: inserted.length }, 201)
})

export default router
