import { Hono } from 'hono'
import { createServiceClient, type HonoVariables } from '../_shared'

const router = new Hono<{ Variables: HonoVariables }>()

// GET /api/income-statement?companyId=&date_from=&date_to=
// Aggregates transactions by category server-side — avoids sending raw rows to the browser.
router.get('/', async (c) => {
  const userId = c.get('userId')
  const db = createServiceClient()
  const companyId = c.req.query('companyId')
  const dateFrom  = c.req.query('date_from')
  const dateTo    = c.req.query('date_to')

  if (!companyId) return c.json({ error: 'companyId required' }, 400)
  if (!dateFrom || !dateTo) return c.json({ error: 'date_from and date_to required' }, 400)

  // Verify membership
  const { data: member } = await db
    .from('company_members')
    .select('id')
    .eq('user_id', userId)
    .eq('company_id', companyId)
    .eq('status', 'accepted')
    .maybeSingle()
  if (!member) return c.json({ error: 'forbidden' }, 403)

  const { data, error } = await db
    .from('transactions')
    .select('type, amount, category_id, categories(id, name)')
    .eq('company_id', companyId)
    .gte('date', dateFrom)
    .lte('date', dateTo)

  if (error) return c.json({ error: error.message }, 400)

  // Aggregate server-side
  type Row = { category_id: string | null; category_name: string; type: string; total: number }
  const map = new Map<string, Row>()

  for (const tx of data ?? []) {
    const cat = tx.categories as unknown as { id: string; name: string } | null
    const key = `${cat?.id ?? '__none'}_${tx.type}`
    if (!map.has(key)) {
      map.set(key, {
        category_id: cat?.id ?? null,
        category_name: cat?.name ?? 'Uncategorized',
        type: tx.type,
        total: 0,
      })
    }
    map.get(key)!.total += Number(tx.amount)
  }

  const result = Array.from(map.values()).sort((a, b) =>
    a.type === b.type
      ? a.category_name.localeCompare(b.category_name)
      : a.type === 'income' ? -1 : 1
  )

  return c.json(result)
})

export default router
