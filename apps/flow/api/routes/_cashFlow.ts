import { Hono } from 'hono'
import { createServiceClient, type HonoVariables } from '../_shared'

const router = new Hono<{ Variables: HonoVariables }>()

// GET /api/cash-flow?companyId=&date_from=&date_to=
// Aggregates transactions by date server-side — avoids sending raw rows to the browser.
router.get('/', async (c) => {
  const userId = c.get('userId')
  const db = createServiceClient()
  const companyId  = c.req.query('company_id')
  const dateFrom   = c.req.query('date_from')
  const dateTo     = c.req.query('date_to')
  const categoryId = c.req.query('category_id')

  if (!companyId) return c.json({ error: 'company_id required' }, 400)
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

  let query = db
    .from('transactions')
    .select('date, type, amount')
    .eq('company_id', companyId)
    .gte('date', dateFrom)
    .lte('date', dateTo)
    .order('date')

  if (categoryId) query = query.eq('category_id', categoryId)

  const { data, error } = await query

  if (error) return c.json({ error: error.message }, 400)

  // Aggregate by date server-side
  const map = new Map<string, { income: number; expense: number }>()

  for (const tx of data ?? []) {
    const entry = map.get(tx.date) ?? { income: 0, expense: 0 }
    if (tx.type === 'income') entry.income += Number(tx.amount)
    else entry.expense += Number(tx.amount)
    map.set(tx.date, entry)
  }

  let accumulated = 0
  const result = Array.from(map.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, { income, expense }]) => {
      accumulated += income - expense
      return { date, income, expense, balance: accumulated }
    })

  return c.json(result)
})

export default router
