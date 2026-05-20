import { Hono } from 'hono'
import { createServiceClient, type HonoVariables } from '../_shared'

const router = new Hono<{ Variables: HonoVariables }>()

// ── POST /api/companies ────────────────────────────────────────
router.post('/', async (c) => {
  const userId = c.get('userId')
  const db = createServiceClient()
  const { name, cnpj, trade_name, tax_regime, segment } = await c.req.json<{
    name: string; cnpj?: string; trade_name?: string; tax_regime?: string; segment?: string
  }>()

  if (!name?.trim()) return c.json({ error: 'name_required' }, 400)

  const payload: Record<string, unknown> = { name: name.trim(), owner_id: userId }
  if (cnpj)       payload.cnpj       = cnpj
  if (trade_name) payload.trade_name = trade_name
  if (tax_regime) payload.tax_regime = tax_regime
  if (segment)    payload.segment    = segment

  const { data, error } = await db.from('companies').insert(payload).select('id, name').single()
  if (error) return c.json({ error: 'internal_error' }, 500)

  // Inserir o dono como membro admin aceito
  const { error: memberError } = await db.from('company_members').insert({
    company_id: data.id,
    user_id: userId,
    email: (await db.from('profiles').select('email').eq('id', userId).single()).data?.email ?? '',
    role: 'admin',
    status: 'accepted',
    joined_at: new Date().toISOString(),
  })
  if (memberError) return c.json({ error: 'internal_error' }, 500)

  return c.json(data, 201)
})

// ── GET /api/companies/:id ─────────────────────────────────────
router.get('/:id', async (c) => {
  const userId = c.get('userId')
  const db = createServiceClient()
  const { id } = c.req.param()

  const { data: member } = await db.from('company_members')
    .select('id').eq('user_id', userId).eq('company_id', id).eq('status', 'accepted').maybeSingle()

  // Fallback: owner pode não ter linha em company_members (empresas criadas antes da correção)
  if (!member) {
    const { data: company } = await db.from('companies').select('owner_id').eq('id', id).single()
    if (company?.owner_id !== userId) return c.json({ error: 'forbidden' }, 403)
  }

  const { data } = await db.from('companies').select('id, name, cnpj, tax_regime, trade_name, segment').eq('id', id).single()
  return c.json(data)
})

// ── PATCH /api/companies/:id ───────────────────────────────────
router.patch('/:id', async (c) => {
  const userId = c.get('userId')
  const db = createServiceClient()
  const { id } = c.req.param()
  const body = await c.req.json<{ name?: string; cnpj?: string; trade_name?: string; tax_regime?: string; segment?: string }>()

  // Check if user is admin member
  const { data: admin } = await db.from('company_members')
    .select('id')
    .eq('user_id', userId)
    .eq('company_id', id)
    .eq('status', 'accepted')
    .eq('role', 'admin')
    .maybeSingle()
  if (!admin) return c.json({ error: 'forbidden' }, 403)

  // Whitelist allowed fields
  const updates: Record<string, unknown> = {}
  if (body.name !== undefined) {
    if (!body.name.trim()) return c.json({ error: 'name_required' }, 400)
    updates.name = body.name.trim()
  }
  if (body.cnpj       !== undefined) updates.cnpj       = body.cnpj
  if (body.trade_name !== undefined) updates.trade_name = body.trade_name
  if (body.tax_regime !== undefined) updates.tax_regime = body.tax_regime
  if (body.segment    !== undefined) updates.segment    = body.segment

  if (Object.keys(updates).length === 0) return c.json({ error: 'no_changes' }, 400)

  const { data, error } = await db.from('companies').update(updates).eq('id', id).select('id, name, cnpj, tax_regime').single()
  if (error) return c.json({ error: 'internal_error' }, 500)
  return c.json(data)
})

export default router
