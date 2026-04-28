import { Hono } from 'hono'
import { createServiceClient, type HonoVariables } from '../_shared'

const router = new Hono<{ Variables: HonoVariables }>()

// ── GET /api/companies ─────────────────────────────────────────
router.get('/', async (c) => {
  const userId = c.get('userId')
  const db = createServiceClient()

  const { data, error } = await db.from('accountant_companies')
    .select('*, companies(id, name, cnpj, tax_regime, segment)')
    .eq('accountant_id', userId)
    .eq('status', 'accepted')
    .order('accepted_at', { ascending: false })
  if (error) return c.json({ error: error.message }, 400)
  return c.json(data ?? [])
})

// ── GET /api/companies/:id ─────────────────────────────────────
router.get('/:id', async (c) => {
  const userId = c.get('userId')
  const db = createServiceClient()
  const { id } = c.req.param()

  const { data: acct } = await db.from('accountant_companies')
    .select('id').eq('accountant_id', userId).eq('company_id', id).eq('status', 'accepted').maybeSingle()
  if (!acct) return c.json({ error: 'forbidden' }, 403)

  const { data } = await db.from('companies').select('id, name, cnpj, tax_regime').eq('id', id).single()
  return c.json(data)
})

export default router
