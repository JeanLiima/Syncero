import { Hono } from 'hono'
import { createServiceClient, type HonoVariables } from '../_shared'

const router = new Hono<{ Variables: HonoVariables }>()

// ── POST /api/companies ────────────────────────────────────────
router.post('/', async (c) => {
  const userId = c.get('userId')
  const db = createServiceClient()
  const { name, cnpj, tax_regime } = await c.req.json<{ name: string; cnpj?: string; tax_regime?: string }>()

  if (!name?.trim()) return c.json({ error: 'Nome é obrigatório' }, 400)

  const payload: Record<string, unknown> = { name: name.trim(), owner_id: userId }
  if (cnpj) payload.cnpj = cnpj
  if (tax_regime) payload.tax_regime = tax_regime

  const { data, error } = await db.from('companies').insert(payload).select('id, name').single()
  if (error) return c.json({ error: error.message }, 400)
  return c.json(data, 201)
})

// ── GET /api/companies/:id ─────────────────────────────────────
router.get('/:id', async (c) => {
  const userId = c.get('userId')
  const db = createServiceClient()
  const { id } = c.req.param()

  const { data: member } = await db.from('company_members')
    .select('id').eq('user_id', userId).eq('company_id', id).eq('status', 'accepted').maybeSingle()
  if (!member) return c.json({ error: 'forbidden' }, 403)

  const { data } = await db.from('companies').select('id, name, cnpj, tax_regime').eq('id', id).single()
  return c.json(data)
})

// ── PATCH /api/companies/:id ───────────────────────────────────
router.patch('/:id', async (c) => {
  const userId = c.get('userId')
  const db = createServiceClient()
  const { id } = c.req.param()
  const updates = await c.req.json<Record<string, unknown>>()

  const { data: member } = await db.from('company_members')
    .select('id')
    .eq('user_id', userId)
    .eq('company_id', id)
    .eq('status', 'accepted')
    .maybeSingle()
  if (!member) return c.json({ error: 'forbidden' }, 403)

  const { data, error } = await db.from('companies').update(updates).eq('id', id).select('id, name, cnpj, tax_regime').single()
  if (error) return c.json({ error: error.message }, 400)
  return c.json(data)
})

export default router
