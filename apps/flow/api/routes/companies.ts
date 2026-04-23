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

// ── GET /api/companies/:id/fiscal-summary ──────────────────────
router.get('/:id/fiscal-summary', async (c) => {
  const userId = c.get('userId')
  const db = createServiceClient()
  const { id } = c.req.param()

  const [memberRes, accountantRes] = await Promise.all([
    db.from('company_members').select('id').eq('user_id', userId).eq('company_id', id).eq('status', 'accepted').maybeSingle(),
    db.from('accountant_companies').select('id').eq('accountant_id', userId).eq('company_id', id).eq('status', 'accepted').maybeSingle(),
  ])
  if (!memberRes.data && !accountantRes.data) return c.json({ error: 'forbidden' }, 403)

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
