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
    db.from('tax_calculations').select('tax_value').eq('company_id', id)
      .gte('reference_period', period).lte('reference_period', period),
  ])

  const taxTotal = taxes.data?.reduce((s, t) => s + (t.tax_value as number), 0) ?? 0
  return c.json({ nfeCount: nfe.count ?? 0, booksCount: books.count ?? 0, taxTotal })
})

export default router
