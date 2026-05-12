import { Hono } from 'hono'
import { createServiceClient, type HonoVariables } from '../_shared'

const router = new Hono<{ Variables: HonoVariables }>()

// ── GET /api/companies/:id/fiscal-summary ──────────────────────
router.get('/:id/fiscal-summary', async (c) => {
  const userId = c.get('userId')
  const db = createServiceClient()
  const { id } = c.req.param()

  const { data: acct } = await db.from('accountant_companies')
    .select('id').eq('accountant_id', userId).eq('company_id', id).eq('status', 'accepted').maybeSingle()
  if (!acct) return c.json({ error: 'forbidden' }, 403)

  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const period = `${year}-${month}`

  const [nfe, books, taxes] = await Promise.all([
    db.from('fiscal_documents').select('id', { count: 'exact', head: true }).eq('company_id', id),
    db.from('fiscal_books').select('id', { count: 'exact', head: true }).eq('company_id', id),
    db.from('tax_calculations').select('tax_amount').eq('company_id', id).eq('period', period),
  ])

  const taxTotal = taxes.data?.reduce((s, t) => s + (t.tax_amount as number), 0) ?? 0
  return c.json({ nfeCount: nfe.count ?? 0, booksCount: books.count ?? 0, taxTotal })
})

// ── GET /api/companies/:id/tax-settings ───────────────────────
router.get('/:id/tax-settings', async (c) => {
  const userId = c.get('userId')
  const db = createServiceClient()
  const { id } = c.req.param()

  const { data: link } = await db.from('accountant_companies')
    .select('iss_rate, segment').eq('accountant_id', userId).eq('company_id', id).eq('status', 'accepted').maybeSingle()
  if (!link) return c.json({ error: 'forbidden' }, 403)

  return c.json({ iss_rate: (link as any).iss_rate ?? null, segment: (link as any).segment ?? null })
})

// ── PATCH /api/companies/:id/tax-settings ─────────────────────
router.patch('/:id/tax-settings', async (c) => {
  const userId = c.get('userId')
  const db = createServiceClient()
  const { id } = c.req.param()

  const { data: link } = await db.from('accountant_companies')
    .select('id').eq('accountant_id', userId).eq('company_id', id).eq('status', 'accepted').maybeSingle()
  if (!link) return c.json({ error: 'forbidden' }, 403)

  const body = await c.req.json<{ iss_rate?: number | null; segment?: string | null }>()

  const updates: Record<string, unknown> = {}
  if (body.iss_rate !== undefined) updates.iss_rate = body.iss_rate ?? null
  if (body.segment  !== undefined) updates.segment  = body.segment  ?? null

  const { error } = await db.from('accountant_companies')
    .update(updates)
    .eq('accountant_id', userId)
    .eq('company_id', id)
  if (error) return c.json({ error: error.message }, 500)

  return c.json({ iss_rate: body.iss_rate ?? null, segment: body.segment ?? null })
})

export default router
