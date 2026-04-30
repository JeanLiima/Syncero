import { Hono } from 'hono'
import { streamSSE } from 'hono/streaming'
import { createServiceClient, type HonoVariables } from '../_shared'

const router = new Hono<{ Variables: HonoVariables }>()

// ── GET /api/transactions ──────────────────────────────────────
// Returns Flow transactions for a linked company, with classification status.
router.get('/', async (c) => {
  const userId = c.get('userId')
  const db = createServiceClient()
  const { companyId, type, is_paid, date_from, date_to, search, page = '1', pageSize = '20' } = c.req.query()

  if (!companyId) return c.json({ error: 'companyId required' }, 400)

  const { data: acct } = await db.from('accountant_companies')
    .select('id').eq('accountant_id', userId).eq('company_id', companyId).eq('status', 'accepted').maybeSingle()
  if (!acct) return c.json({ error: 'Forbidden: not authorized for this company' }, 403)

  const pageNum  = Math.max(1, parseInt(page))
  const size     = Math.min(100, Math.max(1, parseInt(pageSize)))
  const from     = (pageNum - 1) * size
  const to       = from + size - 1

  let q = db.from('transactions')
    .select('id, company_id, description, amount, type, date, is_paid, notes, category_id, contact_id, nature, is_installment, installment_number, installment_count, paid_at, payment_method, bank_id, created_by, created_at, updated_at, categories(id, name, color)', { count: 'exact' })
    .eq('company_id', companyId)
    .order('date', { ascending: false })
    .range(from, to)

  if (type)      q = q.eq('type', type)
  if (is_paid)   q = q.eq('is_paid', is_paid === 'true')
  if (date_from) q = q.gte('date', date_from)
  if (date_to)   q = q.lte('date', date_to)
  if (search)    q = q.ilike('description', `%${search}%`)

  const { data: txs, count, error } = await q
  if (error) return c.json({ error: 'Failed to fetch transactions' }, 500)
  if (!txs?.length) return c.json({ data: [], count: 0 })

  // Fetch which transactions are already classified
  const txIds = txs.map(t => t.id)
  const { data: entries } = await db.from('journal_entries')
    .select('flow_transaction_id, id')
    .eq('company_id', companyId)
    .in('flow_transaction_id', txIds)

  const classifiedMap = new Map((entries ?? []).map(e => [e.flow_transaction_id as string, e.id as string]))

  return c.json({
    data: txs.map(t => ({
      ...t,
      is_classified: classifiedMap.has(t.id),
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

  if (error || !tx) return c.json({ error: 'Not found' }, 404)

  // Verify accountant is linked to the company
  const { data: acct } = await db.from('accountant_companies')
    .select('id').eq('accountant_id', userId).eq('company_id', tx.company_id).eq('status', 'accepted').maybeSingle()
  if (!acct) return c.json({ error: 'Forbidden' }, 403)

  return c.json({
    ...tx,
    creator_name:           (tx.creator as { full_name: string } | null)?.full_name ?? null,
    payment_registrar_name: (tx.registrar as { full_name: string } | null)?.full_name ?? null,
  })
})

// ── GET /api/transactions/events (SSE) ───────────────────────
// Pushes a 'transaction' SSE event whenever rows change for this company.
// The frontend invalidates its React Query cache on each event.
router.get('/events', async (c) => {
  const userId    = c.get('userId')
  const db        = createServiceClient()
  const companyId = c.req.query('companyId')
  if (!companyId) return c.json({ error: 'companyId required' }, 400)

  const { data: acct } = await db.from('accountant_companies')
    .select('id').eq('accountant_id', userId).eq('company_id', companyId)
    .eq('status', 'accepted').maybeSingle()
  if (!acct) return c.json({ error: 'forbidden' }, 403)

  return streamSSE(c, async (stream) => {
    const notify = async () => stream.writeSSE({ data: 'update', event: 'transaction' })

    const channel = db
      .channel(`tx-watch:${companyId}`)
      // payment registered / transaction created or updated
      .on('postgres_changes', {
        event:  '*',
        schema: 'public',
        table:  'transactions',
        filter: `company_id=eq.${companyId}`,
      }, notify)
      // transaction classified (new journal entry) → is_classified changes
      .on('postgres_changes', {
        event:  'INSERT',
        schema: 'public',
        table:  'journal_entries',
        filter: `company_id=eq.${companyId}`,
      }, notify)
      .subscribe()

    // Heartbeat every 20s to prevent proxy/edge timeout from closing the stream
    let heartbeat: ReturnType<typeof setInterval>

    await new Promise<void>((resolve) => {
      heartbeat = setInterval(async () => {
        try { await stream.writeSSE({ data: '', event: 'ping' }) }
        catch { resolve() }
      }, 20_000)

      c.req.raw.signal.addEventListener('abort', () => resolve())
    })

    clearInterval(heartbeat!)
    await db.removeChannel(channel)
  })
})

export default router
